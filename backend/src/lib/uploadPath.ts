import path from 'node:path';
import { AppError } from './errors.js';

export function resolveUploadPath(root, storageKey) {
  const base = path.resolve(root);
  const full = path.resolve(base, String(storageKey || ''));
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (full !== base && !full.startsWith(prefix)) {
    throw new AppError(400, 'Некорректный путь файла', 'BAD_REQUEST');
  }
  return full;
}
