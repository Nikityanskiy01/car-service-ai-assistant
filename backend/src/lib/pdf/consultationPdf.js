import PDFDocument from 'pdfkit';
import { AppError } from '../errors.js';
import { resolvePdfBodyFontPath } from '../pdfCyrillicFont.js';
import {
  PDF_THEME,
  drawChatBubble,
  drawKeyValuePanel,
  drawPercentBar,
  drawRecommendationRow,
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
 * @param {Awaited<ReturnType<import('../../modules/consultations/consultations.service.js').getSessionDetail>>} session
 * @returns {Promise<Buffer>}
 */
export function buildConsultationPdfBuffer(session) {
  const fontPath = resolvePdfBodyFontPath();
  if (!fontPath) {
    throw new AppError(
      503,
      'Не найден TTF-шрифт с кириллицей для PDF. На Linux установите fonts-dejavu-core или задайте PDF_BODY_FONT.',
      'PDF_FONT_MISSING',
    );
  }

  const ext = session.extracted || {};
  const recs = session.recommendations || [];
  const brandName = process.env.PDF_BRAND_NAME?.trim() || 'Автоассистент';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Body', fontPath);
    doc.font('Body');

    const generatedAt = new Date().toLocaleString('ru-RU');
    drawReportHeader(doc, {
      title: 'ИИ-консультация',
      subtitle: `${brandName} · отчёт по сессии\nСформировано: ${generatedAt}`,
    });

    doc.fillColor(PDF_THEME.text);
    doc.moveDown(0.3);

    const metaRows = [
      { label: 'ID сессии', value: session.id },
      { label: 'Статус', value: session.status },
      { label: 'Создана', value: session.createdAt.toLocaleString('ru-RU') },
      { label: 'Обновлена', value: session.updatedAt.toLocaleString('ru-RU') },
    ];
    if (session.serviceCategory?.name) {
      metaRows.splice(2, 0, { label: 'Категория', value: session.serviceCategory.name });
    }
    drawSectionTitle(doc, 'Сессия');
    drawKeyValuePanel(doc, metaRows);

    if (session.progressPercent != null) {
      drawPercentBar(doc, 'Прогресс заполнения', session.progressPercent);
    }
    if (session.confidencePercent != null) {
      drawPercentBar(doc, 'Уверенность извлечённых данных', session.confidencePercent);
    }

    drawSectionTitle(doc, 'Участник');
    const participantRows = session.client
      ? [
          { label: 'Клиент', value: session.client.fullName || '—' },
          { label: 'Телефон', value: session.client.phone || '—' },
          { label: 'Email', value: session.client.emailProfile || session.client.email || '—' },
        ]
      : [
          { label: 'Гость', value: session.guestName || '—' },
          { label: 'Телефон', value: session.guestPhone || '—' },
        ];
    drawKeyValuePanel(doc, participantRows);

    drawSectionTitle(doc, 'Данные по авто');
    drawKeyValuePanel(doc, [
      { label: 'Марка / модель', value: [ext.make, ext.model].filter(Boolean).join(' ') || '—' },
      { label: 'Год', value: ext.year != null ? String(ext.year) : '—' },
      { label: 'Пробег', value: ext.mileage != null ? String(ext.mileage) : '—' },
      { label: 'Симптомы', value: truncate(ext.symptoms, 3000) || '—' },
      { label: 'Условия', value: truncate(ext.problemConditions, 2000) || '—' },
    ]);

    if (recs.length) {
      drawSectionTitle(doc, 'Вероятные направления диагностики');
      for (const r of recs) {
        drawRecommendationRow(doc, r.title, Number(r.probabilityPercent) || 0);
      }
    }

    if (session.preliminaryNote) {
      drawSectionTitle(doc, 'Примечание');
      const m = doc.page.margins;
      const w = doc.page.width - m.left - m.right;
      ensureVerticalSpace(doc, 40);
      doc.fontSize(10).fillColor(PDF_THEME.text).text(truncate(session.preliminaryNote, 2000), {
        width: w,
        lineGap: 2,
      });
      doc.moveDown(0.8);
    }

    const msgs = session.messages || [];
    drawSectionTitle(doc, 'Переписка');
    if (!msgs.length) {
      doc.fontSize(10).fillColor(PDF_THEME.muted).text('Сообщений нет.');
      doc.moveDown(0.5);
    } else {
      for (const m of msgs) {
        const body = truncate(m.content, 8000);
        drawChatBubble(doc, {
          role: m.sender,
          headerLine: `${senderRu(m.sender)} · ${m.createdAt.toLocaleString('ru-RU')}`,
          body,
        });
      }
    }

    doc.moveDown(0.8);
    ensureVerticalSpace(doc, 36);
    doc.fontSize(8).fillColor(PDF_THEME.faint).text(
      'Сохраните отчёт для записи в сервис. Документ сформирован автоматически; ответы ассистента носят справочный характер и не заменяют очную диагностику.',
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, lineGap: 1 },
    );

    doc.end();
  });
}
