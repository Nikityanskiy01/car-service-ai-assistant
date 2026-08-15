import { AppError } from './errors.js';

const MAGIC = {
  'image/jpeg': [(buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff],
  'image/png': [
    (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  ],
  'image/gif': [(buf) => buf.length >= 6 && buf.subarray(0, 6).toString('ascii').startsWith('GIF8')],
  'image/webp': [
    (buf) =>
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP',
  ],
  'application/pdf': [(buf) => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-'],
};

export function assertMagicMime(buffer, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  const checks = MAGIC[mime];
  if (!checks) {
    throw new AppError(400, 'Недопустимый тип файла', 'BAD_REQUEST');
  }
  if (!checks.some((fn) => fn(buffer))) {
    throw new AppError(400, 'Содержимое файла не соответствует заявленному типу', 'BAD_REQUEST');
  }
}

export function contentDisposition(fileName, { inline = false } = {}) {
  const safe = encodeURIComponent(String(fileName || 'file').replace(/[\r\n"]/g, ''));
  const kind = inline ? 'inline' : 'attachment';
  return `${kind}; filename="${safe}"; filename*=UTF-8''${safe}`;
}
