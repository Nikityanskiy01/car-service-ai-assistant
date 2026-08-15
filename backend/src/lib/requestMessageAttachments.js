import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { assertMagicMime } from './fileMagic.js';
import { sanitizeUploadedImage } from './imageSanitize.js';

const UPLOAD_ROOT =
  process.env.REQUEST_MESSAGE_UPLOAD_DIR ||
  path.join(process.cwd(), 'data', 'uploads', 'request-messages');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

export function getUploadRoot() {
  return UPLOAD_ROOT;
}

export function validateAttachmentInput({ fileName, mimeType, contentBase64 }) {
  const name = String(fileName || 'file').trim().slice(0, 200) || 'file';
  const mime = String(mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppError(400, 'Недопустимый тип файла', 'BAD_REQUEST');
  }
  const raw = String(contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) throw new AppError(400, 'Пустой файл', 'BAD_REQUEST');
  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw new AppError(400, 'Некорректные данные файла', 'BAD_REQUEST');
  }
  if (!buffer.length) throw new AppError(400, 'Пустой файл', 'BAD_REQUEST');
  if (buffer.length > MAX_FILE_BYTES) {
    throw new AppError(400, 'Файл слишком большой (макс. 4 МБ)', 'BAD_REQUEST');
  }
  assertMagicMime(buffer, mime);
  const clean = sanitizeUploadedImage(buffer, mime);
  return {
    fileName: name,
    mimeType: clean.mimeType,
    buffer: clean.buffer,
    sizeBytes: clean.sizeBytes,
  };
}

export async function saveAttachmentFile(buffer, attachmentId) {
  const dir = path.join(UPLOAD_ROOT, attachmentId.slice(0, 2));
  await fs.mkdir(dir, { recursive: true });
  const storageKey = path.join(attachmentId.slice(0, 2), attachmentId);
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  await fs.writeFile(fullPath, buffer);
  return storageKey;
}

export async function readAttachmentFile(storageKey) {
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  return fs.readFile(fullPath);
}

export function serializeAttachment(row, requestId) {
  return {
    id: row.id,
    fileName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: `/api/service-requests/${requestId}/messages/${row.messageId}/attachments/${row.id}`,
  };
}

export { MAX_ATTACHMENTS };
