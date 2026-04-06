import fs from 'fs';
import path from 'path';

/**
 * Путь к TTF с кириллицей для PDFKit. Windows: Arial; Linux: DejaVu / Liberation.
 * Переопределение: переменная окружения PDF_BODY_FONT (полный путь к .ttf).
 */
export function resolvePdfBodyFontPath() {
  const env = process.env.PDF_BODY_FONT;
  if (env && fs.existsSync(env)) return env;

  const winRoot = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
  const candidates = [
    path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf'),
    process.platform === 'win32' ? path.join(winRoot, 'Fonts', 'arial.ttf') : null,
    process.platform === 'win32' ? path.join(winRoot, 'Fonts', 'segoeui.ttf') : null,
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}
