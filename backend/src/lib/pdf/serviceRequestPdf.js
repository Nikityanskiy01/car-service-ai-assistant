import PDFDocument from 'pdfkit';
import prisma from '../prisma.js';
import { AppError } from '../errors.js';
import { resolvePdfBodyFontPath } from '../pdfCyrillicFont.js';
import * as serviceRequestsService from '../../modules/serviceRequests/serviceRequests.service.js';
import {
  PDF_THEME,
  drawChatBubble,
  drawKeyValuePanel,
  drawReportHeader,
  drawSectionTitle,
  ensureVerticalSpace,
} from './pdfLayout.js';

function truncate(s, max) {
  const t = String(s ?? '');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function senderRu(s) {
  const m = { USER: 'Клиент', ASSISTANT: 'Ассистент', SYSTEM: 'Система' };
  return m[s] || s;
}

/**
 * @param {string} requestId
 * @param {import('@prisma/client').User} user
 * @returns {Promise<Buffer>}
 */
export async function buildServiceRequestPdfBuffer(requestId, user) {
  const row = await serviceRequestsService.getRequest(requestId, user);
  const followUps = await prisma.requestFollowUpMessage.findMany({
    where: { requestId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { fullName: true, role: true } } },
  });

  const fontPath = resolvePdfBodyFontPath();
  if (!fontPath) {
    throw new AppError(
      503,
      'Не найден TTF-шрифт с кириллицей для PDF. На Linux установите fonts-dejavu-core или задайте PDF_BODY_FONT.',
      'PDF_FONT_MISSING',
    );
  }

  const brandName = process.env.PDF_BRAND_NAME?.trim() || 'Автоассистент';
  const generatedAt = new Date().toLocaleString('ru-RU');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Body', fontPath);
    doc.font('Body');

    drawReportHeader(doc, {
      title: 'Заявка на ремонт',
      subtitle: `${brandName} · карточка заявки\nСформировано: ${generatedAt}`,
    });

    doc.fillColor(PDF_THEME.text);
    doc.moveDown(0.3);

    drawSectionTitle(doc, 'Заявка');
    drawKeyValuePanel(doc, [
      { label: 'Идентификатор', value: row.id },
      { label: 'Статус', value: row.status },
      { label: 'Версия', value: String(row.version) },
      { label: 'Создана', value: row.createdAt.toLocaleString('ru-RU') },
    ]);

    drawSectionTitle(doc, 'Клиент');
    const clientRows = row.client
      ? [
          { label: 'Имя', value: row.client.fullName || '—' },
          { label: 'Телефон', value: row.client.phone || '—' },
          { label: 'Email', value: row.client.emailProfile || row.client.email || '—' },
        ]
      : [
          { label: 'Гость', value: row.guestName || '—' },
          { label: 'Телефон', value: row.guestPhone || '—' },
          { label: 'Email', value: row.guestEmail || '—' },
        ];
    drawKeyValuePanel(doc, clientRows);

    drawSectionTitle(doc, 'Авто и симптомы');
    const car = `${row.snapshotMake || ''} ${row.snapshotModel || ''}`.trim() || '—';
    drawKeyValuePanel(doc, [
      { label: 'Марка / модель', value: car },
      { label: 'Симптомы', value: truncate(row.snapshotSymptoms, 4000) || '—' },
    ]);

    const msgs = row.consultationSession?.messages || [];
    if (msgs.length) {
      drawSectionTitle(doc, 'Транскрипт ИИ-консультации');
      for (const m of msgs) {
        drawChatBubble(doc, {
          role: m.sender,
          headerLine: `${senderRu(m.sender)} · ${m.createdAt.toLocaleString('ru-RU')}`,
          body: truncate(m.content, 8000),
        });
      }
    }

    if (followUps.length) {
      drawSectionTitle(doc, 'Переписка с сервисом');
      for (const m of followUps) {
        const name = m.author?.fullName || 'Сотрудник';
        ensureVerticalSpace(doc, 48);
        const body = truncate(m.body, 8000);
        const mgn = doc.page.margins;
        const w = doc.page.width - mgn.left - mgn.right;
        doc.fontSize(9).fillColor(PDF_THEME.muted).text(`${name} · ${m.createdAt.toLocaleString('ru-RU')}`);
        doc.fillColor(PDF_THEME.text).fontSize(10).text(body, { width: w, lineGap: 2 });
        doc.moveDown(0.5);
      }
    }

    doc.moveDown(0.8);
    ensureVerticalSpace(doc, 36);
    doc.fontSize(8).fillColor(PDF_THEME.faint).text(
      'Документ сформирован автоматически. Ответы ИИ носят информационный характер и не заменяют диагностику в сервисе.',
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, lineGap: 1 },
    );

    doc.end();
  });
}
