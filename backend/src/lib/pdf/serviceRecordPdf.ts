import JPEG from 'jpeg-js';
import PDFDocument from 'pdfkit';
import { AppError } from '../errors.js';
import { CATEGORY_TITLES } from '../maintenanceIntervals.js';
import { resolvePdfBodyFontPath } from '../pdfCyrillicFont.js';
import {
  PDF_THEME,
  drawKeyValuePanel,
  drawReportHeader,
  drawSectionTitle,
  ensureVerticalSpace,
} from './pdfLayout.js';

function formatMoney(minor) {
  if (minor == null || !Number.isFinite(Number(minor))) return '—';
  return `${Math.round(Number(minor) / 100).toLocaleString('ru-RU')} ₽`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

function vehicleLabel(vehicle) {
  if (!vehicle) return 'Автомобиль';
  return [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
}

/**
 * @param opts
 * @returns
 */
export function buildServiceRecordPdfBuffer({ record, vehicle, brandName }: any) {
  const fontPath = resolvePdfBodyFontPath();
  if (!fontPath) {
    throw new AppError(
      503,
      'Не найден TTF-шрифт с кириллицей для PDF. На Linux установите fonts-dejavu-core или задайте PDF_BODY_FONT.',
      'PDF_FONT_MISSING',
    );
  }

  const brand = brandName || process.env.PDF_BRAND_NAME?.trim() || 'Автоассистент';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Body', fontPath);
    doc.font('Body');

    drawReportHeader(doc, {
      title: 'Запись обслуживания',
      subtitle: `${brand} · сервисная книжка\nСформировано: ${new Date().toLocaleString('ru-RU')}`,
    });

    drawSectionTitle(doc, 'Автомобиль');
    drawKeyValuePanel(doc, [
      { label: 'Авто', value: vehicleLabel(vehicle) },
      { label: 'VIN', value: vehicle?.vin || '—' },
    ]);

    drawSectionTitle(doc, 'Работы');
    drawKeyValuePanel(doc, [
      { label: 'Название', value: record.title },
      { label: 'Категория', value: CATEGORY_TITLES[record.category] || record.category },
      { label: 'Дата', value: formatDate(record.performedAt) },
      {
        label: 'Пробег',
        value: record.mileageKm != null ? `${record.mileageKm.toLocaleString('ru-RU')} км` : '—',
      },
      { label: '№ заказ-наряда', value: record.workOrderNumber || '—' },
      { label: 'Сумма', value: formatMoney(record.amountMinor) },
      { label: 'Источник', value: record.source === 'manager_feedback' ? 'Сервис' : 'Клиент' },
    ]);

    if (record.worksDone) {
      ensureVerticalSpace(doc, 80);
      drawSectionTitle(doc, 'Описание работ');
      doc.fillColor(PDF_THEME.text).fontSize(11).text(String(record.worksDone), {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        lineGap: 4,
      });
    }

    doc.end();
  });
}

/**
 * @param opts
 * @returns
 */
export function buildServiceHistoryPdfBuffer({ records, vehicle, brandName }: any) {
  const fontPath = resolvePdfBodyFontPath();
  if (!fontPath) {
    throw new AppError(
      503,
      'Не найден TTF-шрифт с кириллицей для PDF. На Linux установите fonts-dejavu-core или задайте PDF_BODY_FONT.',
      'PDF_FONT_MISSING',
    );
  }

  const brand = brandName || process.env.PDF_BRAND_NAME?.trim() || 'Автоассистент';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Body', fontPath);
    doc.font('Body');

    drawReportHeader(doc, {
      title: 'История обслуживания',
      subtitle: `${brand} · ${vehicleLabel(vehicle)}\nСформировано: ${new Date().toLocaleString('ru-RU')}`,
    });

    drawSectionTitle(doc, 'Автомобиль');
    drawKeyValuePanel(doc, [
      { label: 'Авто', value: vehicleLabel(vehicle) },
      { label: 'VIN', value: vehicle?.vin || '—' },
      {
        label: 'Текущий пробег',
        value:
          vehicle?.currentMileageKm != null
            ? `${vehicle.currentMileageKm.toLocaleString('ru-RU')} км`
            : '—',
      },
    ]);

    drawSectionTitle(doc, `Записи (${records.length})`);
    if (!records.length) {
      doc.fillColor(PDF_THEME.muted).fontSize(11).text('Записей пока нет.');
    } else {
      for (const record of records) {
        ensureVerticalSpace(doc, 90);
        drawKeyValuePanel(doc, [
          { label: 'Дата', value: formatDate(record.performedAt) },
          { label: 'Работы', value: record.title },
          {
            label: 'Пробег',
            value: record.mileageKm != null ? `${record.mileageKm.toLocaleString('ru-RU')} км` : '—',
          },
          { label: 'ЗН', value: record.workOrderNumber || '—' },
          { label: 'Сумма', value: formatMoney(record.amountMinor) },
        ]);
        if (record.worksDone) {
          doc.fillColor(PDF_THEME.muted).fontSize(10).text(String(record.worksDone), { lineGap: 2 });
          doc.moveDown(0.6);
        }
      }
    }

    doc.end();
  });
}

const CYR_TO_LATIN = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'Zh', З: 'Z', И: 'I', Й: 'Y',
  К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U',
  Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Ch', Ш: 'Sh', Щ: 'Sch', Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function toLatinCard(text) {
  return String(text || '')
    .split('')
    .map((ch) => CYR_TO_LATIN[ch] ?? ch)
    .join('');
}

/** 5x7 bitmap font for Latin card text. */
const FONT = {
  ' ': [0, 0, 0, 0, 0],
  '-': [0, 0, 31, 0, 0],
  ':': [0, 10, 0, 10, 0],
  '.': [0, 0, 0, 0, 4],
  ',': [0, 0, 0, 4, 8],
  '/': [2, 4, 8, 16, 32],
  0: [14, 17, 17, 17, 14],
  1: [4, 12, 4, 4, 14],
  2: [14, 1, 14, 16, 31],
  3: [30, 1, 14, 1, 30],
  4: [17, 17, 31, 1, 1],
  5: [31, 16, 30, 1, 30],
  6: [14, 16, 30, 17, 14],
  7: [31, 1, 2, 4, 4],
  8: [14, 17, 14, 17, 14],
  9: [14, 17, 15, 1, 14],
  A: [14, 17, 31, 17, 17],
  B: [30, 17, 30, 17, 30],
  C: [14, 17, 16, 17, 14],
  D: [30, 17, 17, 17, 30],
  E: [31, 16, 30, 16, 31],
  F: [31, 16, 30, 16, 16],
  G: [14, 16, 19, 17, 14],
  H: [17, 17, 31, 17, 17],
  I: [14, 4, 4, 4, 14],
  J: [1, 1, 1, 17, 14],
  K: [17, 18, 28, 18, 17],
  L: [16, 16, 16, 16, 31],
  M: [17, 27, 21, 17, 17],
  N: [17, 25, 21, 19, 17],
  O: [14, 17, 17, 17, 14],
  P: [30, 17, 30, 16, 16],
  Q: [14, 17, 17, 19, 15],
  R: [30, 17, 30, 18, 17],
  S: [15, 16, 14, 1, 30],
  T: [31, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 14],
  V: [17, 17, 17, 10, 4],
  W: [17, 17, 21, 27, 17],
  X: [17, 10, 4, 10, 17],
  Y: [17, 10, 4, 4, 4],
  Z: [31, 2, 4, 8, 31],
  a: [0, 14, 1, 15, 15],
  b: [16, 30, 17, 17, 30],
  c: [0, 14, 16, 16, 14],
  d: [1, 15, 17, 17, 15],
  e: [0, 14, 31, 16, 14],
  f: [6, 8, 28, 8, 8],
  g: [0, 15, 17, 15, 1],
  h: [16, 30, 17, 17, 17],
  i: [4, 0, 12, 4, 14],
  j: [2, 0, 2, 2, 28],
  k: [16, 18, 28, 18, 17],
  l: [12, 4, 4, 4, 14],
  m: [0, 26, 21, 21, 21],
  n: [0, 30, 17, 17, 17],
  o: [0, 14, 17, 17, 14],
  p: [0, 30, 17, 30, 16],
  q: [0, 15, 17, 15, 1],
  r: [0, 22, 24, 16, 16],
  s: [0, 15, 16, 1, 30],
  t: [8, 28, 8, 8, 6],
  u: [0, 17, 17, 17, 15],
  v: [0, 17, 17, 10, 4],
  w: [0, 17, 21, 21, 10],
  x: [0, 17, 10, 10, 17],
  y: [0, 17, 17, 15, 1],
  z: [0, 31, 2, 4, 31],
  '?': [14, 1, 6, 0, 4],
};

/**
 * JPEG-карточка записи для мессенджеров (латиница/транслит — bitmap без TTF).
 * @param opts
 * @returns
 */
export function buildServiceRecordJpegBuffer({ record, vehicle }: any) {
  const width = 720;
  const height = 400;
  const data = Buffer.alloc(width * height * 4, 255);

  function fillRect(x0, y0, w, h, r, g, b) {
    for (let y = y0; y < y0 + h; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = x0; x < x0 + w; x += 1) {
        if (x < 0 || x >= width) continue;
        const o = (y * width + x) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
    }
  }

  fillRect(0, 0, width, height, 12, 39, 68);
  fillRect(0, 0, width, 10, 13, 148, 136);

  function drawChar(ch, x, y, scale, r, g, b) {
    const glyph = FONT[ch] || FONT['?'];
    for (let col = 0; col < 5; col += 1) {
      const bits = glyph[col] || 0;
      for (let row = 0; row < 7; row += 1) {
        if (bits & (1 << row)) {
          fillRect(x + col * scale, y + row * scale, scale, scale, r, g, b);
        }
      }
    }
  }

  function drawText(text, x, y, scale, r, g, b) {
    let cx = x;
    for (const ch of text) {
      if (ch === '\n') continue;
      drawChar(ch, cx, y, scale, r, g, b);
      cx += 6 * scale;
    }
  }

  const lines = [
    toLatinCard('Zapis obsluzhivaniya'),
    toLatinCard(vehicleLabel(vehicle)),
    '',
    toLatinCard(record.title || CATEGORY_TITLES[record.category] || 'Raboty'),
    toLatinCard(`Data: ${formatDate(record.performedAt)}`),
    toLatinCard(
      `Probeg: ${record.mileageKm != null ? `${record.mileageKm.toLocaleString('ru-RU')} km` : '-'}`,
    ),
    toLatinCard(`ZN: ${record.workOrderNumber || '-'}`),
    toLatinCard(`Summa: ${formatMoney(record.amountMinor)}`),
  ];

  let y = 36;
  lines.forEach((line, idx) => {
    const scale = idx === 0 ? 4 : 3;
    drawText(line.slice(0, 42), 28, y, scale, 255, 255, 255);
    y += scale * 8 + (idx === 0 ? 18 : 12);
  });

  const encoded = JPEG.encode({ data, width, height }, 85);
  return Buffer.from(encoded.data);
}
