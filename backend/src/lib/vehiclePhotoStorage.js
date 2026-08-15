import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { assertMagicMime } from './fileMagic.js';
import { sanitizeUploadedImage } from './imageSanitize.js';

const UPLOAD_ROOT =
  process.env.VEHICLE_PHOTO_UPLOAD_DIR ||
  path.join(process.cwd(), 'data', 'uploads', 'vehicles');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function getVehiclePhotoUploadRoot() {
  return UPLOAD_ROOT;
}

export function validateVehiclePhotoInput({ mimeType, contentBase64 }) {
  const mime = String(mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppError(400, 'Допустимы только JPEG, PNG и WebP', 'BAD_REQUEST');
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
    mimeType: clean.mimeType,
    buffer: clean.buffer,
    sizeBytes: clean.sizeBytes,
    ext: clean.ext,
  };
}

export async function saveVehiclePhotoFile(buffer, ext) {
  const id = randomUUID();
  const dir = path.join(UPLOAD_ROOT, id.slice(0, 2));
  await fs.mkdir(dir, { recursive: true });
  const storageKey = path.join(id.slice(0, 2), `${id}.${ext}`);
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  await fs.writeFile(fullPath, buffer);
  return storageKey;
}

export async function readVehiclePhotoFile(storageKey) {
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  return fs.readFile(fullPath);
}

export async function deleteVehiclePhotoFile(storageKey) {
  if (!storageKey) return;
  const fullPath = path.join(UPLOAD_ROOT, storageKey);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

export function vehiclePhotoMimeFromKey(storageKey) {
  if (storageKey?.endsWith('.png')) return 'image/png';
  if (storageKey?.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
