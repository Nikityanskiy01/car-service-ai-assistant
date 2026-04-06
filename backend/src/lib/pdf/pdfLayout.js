/**
 * Общее оформление PDF-отчётов (PDFKit): цвета, шапка, панели, чат-пузыри.
 */

export const PDF_THEME = {
  primary: '#0c2744',
  primaryMid: '#164a7e',
  accent: '#0d9488',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  panelBg: '#f1f5f9',
  panelBorder: '#e2e8f0',
  barTrack: '#e2e8f0',
  barFill: '#0d9488',
  assistantBubble: '#eff6ff',
  assistantBorder: '#93c5fd',
  userBubble: '#ecfdf5',
  userBorder: '#6ee7b7',
  systemBubble: '#f8fafc',
  systemBorder: '#cbd5e1',
};

function margins(doc) {
  return doc.page.margins;
}

function contentWidth(doc) {
  const m = margins(doc);
  return doc.page.width - m.left - m.right;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {number} minHeight
 */
export function ensureVerticalSpace(doc, minHeight) {
  const m = margins(doc);
  const bottom = doc.page.height - m.bottom;
  if (doc.y + minHeight > bottom) {
    doc.addPage();
    doc.y = m.top;
  }
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {{ title: string, subtitle?: string, tagline?: string }} opts
 */
export function drawReportHeader(doc, opts) {
  const m = margins(doc);
  const w = contentWidth(doc);
  const sub = opts.subtitle || opts.tagline;
  const subLineCount = sub ? sub.split('\n').filter(Boolean).length : 0;
  const bandH = subLineCount > 1 ? 102 : sub ? 86 : 72;
  const left = m.left;

  doc.save();
  doc.rect(left, m.top, w, bandH).fill(PDF_THEME.primary);

  const accentW = Math.min(160, w * 0.35);
  doc.rect(left + w - accentW, m.top, accentW, bandH).fill(PDF_THEME.accent);

  doc.fillColor('#ffffff').fontSize(20).text(opts.title, left + 20, m.top + 18, {
    width: w - accentW - 40,
    align: 'left',
  });

  if (sub) {
    doc.fontSize(9).fillColor('#cbd5e1').text(sub, left + 20, m.top + 44, {
      width: w - accentW - 40,
      align: 'left',
      lineGap: 3,
    });
  }

  doc.restore();

  doc.y = m.top + bandH + 20;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {string} title
 */
export function drawSectionTitle(doc, title) {
  ensureVerticalSpace(doc, 36);
  const m = margins(doc);
  const w = contentWidth(doc);
  const y = doc.y;

  doc.save();
  doc.rect(m.left, y + 2, 3, 14).fill(PDF_THEME.accent);
  doc.restore();

  doc.fillColor(PDF_THEME.primary).fontSize(12).text(title, m.left + 12, y, { width: w - 12 });
  doc.moveDown(0.6);
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {Array<{ label: string, value: string }>} rows
 */
export function drawKeyValuePanel(doc, rows) {
  const m = margins(doc);
  const w = contentWidth(doc);
  const pad = 12;
  const labelColW = Math.min(130, w * 0.32);
  const gap = 10;

  let innerH = pad;
  for (const row of rows) {
    doc.fontSize(8);
    const hL = doc.heightOfString(row.label, { width: labelColW });
    doc.fontSize(10);
    const hV = doc.heightOfString(String(row.value), { width: w - 2 * pad - labelColW - gap });
    innerH += Math.max(hL, hV) + 6;
  }
  innerH += pad - 6;

  ensureVerticalSpace(doc, innerH + 16);
  const x = m.left;
  const y = doc.y;

  doc.save();
  doc.roundedRect(x, y, w, innerH, 6).fill(PDF_THEME.panelBg);
  doc.roundedRect(x, y, w, innerH, 6).stroke(PDF_THEME.panelBorder);
  doc.restore();

  let cy = y + pad;
  for (const row of rows) {
    doc.fontSize(8).fillColor(PDF_THEME.muted).text(row.label, x + pad, cy, { width: labelColW });
    doc.fontSize(10).fillColor(PDF_THEME.text).text(String(row.value), x + pad + labelColW + gap, cy, {
      width: w - 2 * pad - labelColW - gap,
    });
    doc.fontSize(8);
    const hL = doc.heightOfString(row.label, { width: labelColW });
    doc.fontSize(10);
    const hV = doc.heightOfString(String(row.value), { width: w - 2 * pad - labelColW - gap });
    cy += Math.max(hL, hV) + 6;
  }

  doc.y = y + innerH + 14;
}

/**
 * Прогресс-бар 0–100 для PDF.
 * @param {import('pdfkit').PDFDocument} doc
 * @param {string} label
 * @param {number} percent
 */
export function drawPercentBar(doc, label, percent) {
  const m = margins(doc);
  const w = contentWidth(doc);
  const barH = 8;
  const rowH = 28;
  ensureVerticalSpace(doc, rowH + 8);

  const y = doc.y;
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));

  doc.fontSize(9).fillColor(PDF_THEME.muted).text(label, m.left, y, { width: w * 0.55 });
  doc.fillColor(PDF_THEME.text).fontSize(9).text(`${pct}%`, m.left + w * 0.55, y, {
    width: w * 0.45 - 4,
    align: 'right',
  });

  const by = y + 14;
  doc.save();
  doc.roundedRect(m.left, by, w, barH, 3).fill(PDF_THEME.barTrack);
  if (pct > 0) {
    const fillW = Math.max(2, (w * pct) / 100);
    doc.roundedRect(m.left, by, fillW, barH, 3).fill(PDF_THEME.barFill);
  }
  doc.restore();

  doc.y = by + barH + 10;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {string} title
 * @param {number} probabilityPercent
 */
export function drawRecommendationRow(doc, title, probabilityPercent) {
  const m = margins(doc);
  const w = contentWidth(doc);
  const pad = 10;
  const barW = w - 2 * pad;
  const barH = 6;
  const pct = Math.max(0, Math.min(100, Number(probabilityPercent) || 0));

  doc.fontSize(10).fillColor(PDF_THEME.text);
  const titleH = doc.heightOfString(title, { width: barW });
  const blockH = pad + titleH + 6 + barH + pad;

  ensureVerticalSpace(doc, blockH + 6);
  const x = m.left;
  const y = doc.y;

  doc.save();
  doc.roundedRect(x, y, w, blockH, 5).fill('#ffffff');
  doc.roundedRect(x, y, w, blockH, 5).stroke(PDF_THEME.panelBorder);
  doc.restore();

  doc.fillColor(PDF_THEME.text).fontSize(10).text(title, x + pad, y + pad, { width: barW });

  const by = y + pad + titleH + 4;
  doc.save();
  doc.roundedRect(x + pad, by, barW, barH, 2).fill(PDF_THEME.barTrack);
  if (pct > 0) {
    const fillW = Math.max(2, (barW * pct) / 100);
    doc.roundedRect(x + pad, by, fillW, barH, 2).fill(PDF_THEME.primaryMid);
  }
  doc.restore();
  doc.fillColor(PDF_THEME.muted).fontSize(8).text(`${pct}%`, x + pad, by + barH + 2, { width: barW });

  doc.y = y + blockH + 8;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {{ role: string, headerLine: string, body: string }} opts
 */
export function drawChatBubble(doc, opts) {
  const m = margins(doc);
  const pageW = doc.page.width;
  const w = contentWidth(doc);
  const bubbleW = w * 0.84;
  const pad = 11;
  const radius = 7;

  const role = opts.role;
  let fill;
  let stroke;
  let align;
  if (role === 'USER') {
    fill = PDF_THEME.userBubble;
    stroke = PDF_THEME.userBorder;
    align = 'right';
  } else if (role === 'ASSISTANT') {
    fill = PDF_THEME.assistantBubble;
    stroke = PDF_THEME.assistantBorder;
    align = 'left';
  } else {
    fill = PDF_THEME.systemBubble;
    stroke = PDF_THEME.systemBorder;
    align = 'left';
  }

  const bodyW = bubbleW - 2 * pad;
  doc.fontSize(8);
  const hHead = doc.heightOfString(opts.headerLine, { width: bodyW });
  doc.fontSize(10);
  const hBody = doc.heightOfString(opts.body, { width: bodyW });
  const bubbleH = pad + hHead + 5 + hBody + pad;

  ensureVerticalSpace(doc, bubbleH + 12);

  let x = m.left;
  if (align === 'right') x = pageW - m.right - bubbleW;
  const y = doc.y;

  doc.save();
  doc.roundedRect(x, y, bubbleW, bubbleH, radius).fill(fill);
  doc.roundedRect(x, y, bubbleW, bubbleH, radius).stroke(stroke);
  doc.restore();

  doc.fillColor(PDF_THEME.muted).fontSize(8).text(opts.headerLine, x + pad, y + pad, { width: bodyW });
  doc.fillColor(PDF_THEME.text).fontSize(10).text(opts.body, x + pad, y + pad + hHead + 5, { width: bodyW });

  doc.y = y + bubbleH + 10;
}
