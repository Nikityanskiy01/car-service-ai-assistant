import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

/**
 * Нормализация телефона: только цифры, ведущая 8 → 7, 10 цифр без кода → +7…
 * @param {string} raw
 */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return d;
}

/**
 * Допускаем РФ 7XXXXXXXXXX (11 цифр) или международный 10–15 цифр.
 * @param {string} digits
 */
export function isValidPhoneDigits(digits) {
  if (!digits || digits.length < 10 || digits.length > 15) return false;
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length === 11 && digits[0] === '7') return true;
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * @param {{ fullName: string; phone: string; message?: string | null }}
 */
export async function createSubmission({ fullName, phone, message }) {
  const digits = normalizePhone(phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }
  const msg = message != null ? String(message).trim() : '';
  return prisma.contactSubmission.create({
    data: {
      fullName: fullName.trim(),
      phone: digits,
      message: msg.length ? msg.slice(0, 4000) : null,
    },
  });
}

export async function listSubmissions({ take = 100 } = {}) {
  const rows = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(take, 1), 200),
  });
  return rows;
}
