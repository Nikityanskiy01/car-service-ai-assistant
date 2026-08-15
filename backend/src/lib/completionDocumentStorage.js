import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './errors.js';
import { assertMagicMime } from './fileMagic.js';
import { sanitizeUploadedImage } from './imageSanitize.js';

const UPLOAD_ROOT =
  process.env.COMPLETION_DOCUMENT_UPLOAD_DIR ||
  path.join(process.cwd(), 'data', 'uploads', 'completion-documents');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_COMPLETION_DOCUMENTS = 12;

export const COMPLETION_DOCUMENT_KINDS = [
  'WORK_ORDER',
  'RECEIPT',
  'WARRANTY',
  'ACT',
  'OTHER',
];

export const COMPLETION_DOCUMENT_KIND_LABELS = {
  WORK_ORDER: 'Заказ-наряд',
  RECEIPT: 'Чек / квитанция',
  WARRANTY: 'Гарантийный талон',
  ACT: 'Акт выполненных работ',
  OTHER: 'Другой документ',
};

export function getCompletionDocumentUploadRoot() {
  return UPLOAD_ROOT;
}

export function validateCompletionDocumentInput({ fileName, mimeType, contentBase64, kind, label }) {
  const docKind = String(kind || '').trim().toUpperCase();
  if (!COMPLETION_DOCUMENT_KINDS.includes(docKind)) {
    throw new AppError(400, 'Некорректный тип документа', 'BAD_REQUEST');
  }
  const customLabel = String(label || '').trim().slice(0, 120) || null;
  if (docKind === 'OTHER' && !customLabel) {
    throw new AppError(400, 'Укажите название для документа', 'BAD_REQUEST');
  }

  const name = String(fileName || 'file').trim().slice(0, 200) || 'file';
  const mime = String(mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppError(400, 'Недопустимый тип файла (JPG, PNG, PDF)', 'BAD_REQUEST');
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
    throw new AppError(400, 'Файл слишком большой (макс. 8 МБ)', 'BAD_REQUEST');
  }
  assertMagicMime(buffer, mime);
  const clean = sanitizeUploadedImage(buffer, mime);
  return {
    fileName: name,
    mimeType: clean.mimeType,
    buffer: clean.buffer,
    sizeBytes: clean.sizeBytes,
    kind: docKind,
    label: customLabel,
  };
}

export async function saveCompletionDocumentFile(buffer, documentId) {
  const dir = path.join(UPLOAD_ROOT, documentId.slice(0, 2));
  await fs.mkdir(dir, { recursive: true });
  const storageKey = path.join(documentId.slice(0, 2), documentId);
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  await fs.writeFile(fullPath, buffer);
  return storageKey;
}

export async function readCompletionDocumentFile(storageKey) {
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  return fs.readFile(fullPath);
}

export function serializeCompletionDocument(row, requestId) {
  const kindLabel =
    row.kind === 'OTHER' && row.label
      ? row.label
      : COMPLETION_DOCUMENT_KIND_LABELS[row.kind] || row.kind;
  return {
    id: row.id,
    kind: row.kind,
    kindLabel,
    label: row.label,
    fileName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    uploadedBy: row.uploadedBy
      ? { id: row.uploadedBy.id, fullName: row.uploadedBy.fullName }
      : undefined,
    url: `/api/service-requests/${requestId}/completion-documents/${row.id}`,
  };
}
