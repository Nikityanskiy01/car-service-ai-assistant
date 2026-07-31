#!/usr/bin/env node
/**
 * Генерация PDF из docs/client-role-redesign.md
 * Запуск: node docs/scripts/generate-client-redesign-pdf.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PDFDocument = require(path.join(ROOT, 'backend/node_modules/pdfkit'));
const INPUT = path.join(ROOT, 'docs/client-role-redesign.md');
const OUTPUT = path.join(ROOT, 'docs/client-role-redesign.pdf');
const FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';

const PAGE = { margin: 48, width: 595.28, height: 841.89 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

function stripMd(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/✅/g, '[OK]')
    .replace(/❌/g, '[--]')
    .replace(/⚠️/g, '[!]');
}

function ensureSpace(doc, needed = 40) {
  if (doc.y + needed > PAGE.height - PAGE.margin) {
    doc.addPage();
  }
}

function writeHeading(doc, text, level) {
  const sizes = { 1: 20, 2: 15, 3: 12, 4: 11 };
  const size = sizes[level] || 11;
  ensureSpace(doc, size + 20);
  doc.moveDown(level === 1 ? 0.6 : 0.35);
  doc.font(FONT_BOLD).fontSize(size).fillColor('#111827').text(stripMd(text), {
    width: CONTENT_WIDTH,
    lineGap: 2,
  });
  doc.moveDown(0.2);
}

function writeParagraph(doc, text, opts = {}) {
  const t = stripMd(text).trim();
  if (!t) return;
  ensureSpace(doc, 18);
  doc
    .font(opts.mono ? FONT_MONO : opts.bold ? FONT_BOLD : FONT_REGULAR)
    .fontSize(opts.size || 9.5)
    .fillColor(opts.color || '#1f2937')
    .text(t, { width: CONTENT_WIDTH, lineGap: opts.lineGap ?? 2, continued: false });
  if (!opts.inline) doc.moveDown(0.15);
}

function writeCodeBlock(doc, lines) {
  ensureSpace(doc, 24);
  doc.moveDown(0.15);
  const text = lines.join('\n');
  doc
    .font(FONT_MONO)
    .fontSize(8)
    .fillColor('#374151')
    .text(text, {
      width: CONTENT_WIDTH - 16,
      lineGap: 1,
    });
  doc.moveDown(0.25);
}

function writeTableRow(doc, cells, isHeader = false) {
  const cols = cells.length;
  const colWidth = CONTENT_WIDTH / cols;
  const rowHeight = 14;
  ensureSpace(doc, rowHeight + 4);
  const y = doc.y;
  cells.forEach((cell, i) => {
    doc
      .font(isHeader ? FONT_BOLD : FONT_REGULAR)
      .fontSize(8)
      .fillColor(isHeader ? '#111827' : '#374151')
      .text(stripMd(cell), PAGE.margin + i * colWidth, y, {
        width: colWidth - 6,
        lineBreak: false,
        ellipsis: true,
      });
  });
  doc.y = y + rowHeight;
}

function parseTable(lines, startIdx) {
  const rows = [];
  let i = startIdx;
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    const line = lines[i].trim();
    if (!/^\|[-| :]+\|$/.test(line)) {
      rows.push(
        line
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim()),
      );
    }
    i += 1;
  }
  return { rows, next: i };
}

function buildPdf(markdown) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, autoFirstPage: true });
  const out = fs.createWriteStream(OUTPUT);
  doc.pipe(out);

  doc.info.Title = 'Переосмысление роли CLIENT';
  doc.info.Author = 'Car Service AI Assistant';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let inCode = false;
  let codeBuf = [];

  // Title page block
  doc.font(FONT_BOLD).fontSize(22).fillColor('#ea580c').text('Переосмысление роли CLIENT', {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.3);
  doc.font(FONT_REGULAR).fontSize(10).fillColor('#6b7280').text('Рабочий документ · реализация фаз A–E', {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.15);
  doc.font(FONT_REGULAR).fontSize(9).fillColor('#6b7280').text(`Сгенерировано: ${new Date().toLocaleString('ru-RU')}`, {
    width: CONTENT_WIDTH,
  });
  doc.moveDown(0.8);

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      if (inCode) {
        writeCodeBlock(doc, codeBuf);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    if (line.trim() === '---') {
      ensureSpace(doc, 12);
      doc.moveDown(0.2);
      doc
        .strokeColor('#e5e7eb')
        .moveTo(PAGE.margin, doc.y)
        .lineTo(PAGE.width - PAGE.margin, doc.y)
        .stroke();
      doc.moveDown(0.35);
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      writeHeading(doc, line.slice(2), 1);
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      writeHeading(doc, line.slice(3), 2);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      writeHeading(doc, line.slice(4), 3);
      i += 1;
      continue;
    }
    if (line.startsWith('#### ')) {
      writeHeading(doc, line.slice(5), 4);
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const { rows, next } = parseTable(lines, i);
      if (rows.length) {
        rows.forEach((row, idx) => writeTableRow(doc, row, idx === 0));
        doc.moveDown(0.25);
      }
      i = next;
      continue;
    }

    if (/^[-*] /.test(line.trim())) {
      writeParagraph(doc, `• ${line.trim().replace(/^[-*] /, '')}`, { size: 9.5 });
      i += 1;
      continue;
    }

    if (/^\d+\. /.test(line.trim())) {
      writeParagraph(doc, line.trim(), { size: 9.5 });
      i += 1;
      continue;
    }

    if (line.trim() === '') {
      doc.moveDown(0.12);
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      writeParagraph(doc, line.slice(2), { size: 9, color: '#4b5563' });
      i += 1;
      continue;
    }

    writeParagraph(doc, line, { size: 9.5 });
    i += 1;
  }

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(FONT_REGULAR)) {
    console.error('Не найден DejaVuSans.ttf. Установите fonts-dejavu-core.');
    process.exit(1);
  }
  const md = fs.readFileSync(INPUT, 'utf8');
  await buildPdf(md);
  const stat = fs.statSync(OUTPUT);
  console.log(`PDF: ${OUTPUT} (${Math.round(stat.size / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
