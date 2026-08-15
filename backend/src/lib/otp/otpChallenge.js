import crypto from 'crypto';
import { getEnv } from '../../config/env.js';
import prisma from '../prisma.js';
import { AppError } from '../errors.js';
import { hmacHex, hmacHexMatches, sha256Hex, timingSafeEqualHex } from '../cryptoHash.js';
import { recordFailedLogin } from '../accountLockout.js';

export function hashOtp(code) {
  return hmacHex('otp', String(code || '').trim());
}

export function otpHashMatches(storedHash, code) {
  const normalized = String(code || '').trim();
  if (hmacHexMatches('otp', normalized, storedHash)) return true;
  return timingSafeEqualHex(storedHash, sha256Hex(normalized));
}

export function generateNumericOtp() {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export function generateLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

export function dummyOtpToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function otpTtlMs() {
  return getEnv().OTP_CODE_TTL_MINUTES * 60 * 1000;
}

export async function assertOtpCooldown(userId, purpose, channel) {
  if (!userId) return;
  const env = getEnv();
  const since = new Date(Date.now() - env.OTP_RESEND_COOLDOWN_SECONDS * 1000);
  const recent = await prisma.authOtpChallenge.findFirst({
    where: { userId, purpose, channel, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!recent) return;
  const wait = env.OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
  throw new AppError(
    429,
    `Повторно запросить код можно через ${Math.max(1, wait)} сек.`,
    'OTP_COOLDOWN',
  );
}

export async function createOtpChallenge({ userId, purpose, channel, destination, code, token }) {
  if (userId) {
    await prisma.authOtpChallenge.deleteMany({
      where: { userId, purpose, channel, consumedAt: null },
    });
  }

  const env = getEnv();
  return prisma.authOtpChallenge.create({
    data: {
      userId: userId || null,
      purpose,
      channel,
      destination,
      codeHash: hashOtp(code),
      token: token || crypto.randomBytes(32).toString('base64url'),
      expiresAt: new Date(Date.now() + env.OTP_CODE_TTL_MINUTES * 60 * 1000),
    },
  });
}

export async function consumeOtpChallenge(token, code, { purpose } = {}) {
  const row = await prisma.authOtpChallenge.findUnique({ where: { token } });
  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    throw new AppError(400, 'Неверный или просроченный код', 'BAD_REQUEST');
  }
  if (purpose && row.purpose !== purpose) {
    throw new AppError(400, 'Неверный или просроченный код', 'BAD_REQUEST');
  }

  const env = getEnv();
  if (row.attempts >= env.OTP_MAX_ATTEMPTS) {
    await prisma.authOtpChallenge.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError(400, 'Превышено число попыток. Запросите новый код.', 'BAD_REQUEST');
  }

  const normalized = String(code || '').trim();
  if (!normalized || !otpHashMatches(row.codeHash, normalized)) {
    await prisma.authOtpChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    if (row.userId) await recordFailedLogin(row.userId);
    throw new AppError(400, 'Неверный или просроченный код', 'BAD_REQUEST');
  }

  await prisma.authOtpChallenge.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return row;
}

export function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

export function maskPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length < 4) return '•••';
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 (•••) ••-••-${d.slice(-2)}`;
  }
  return `+${d.slice(0, 1)} ••• ${d.slice(-2)}`;
}
