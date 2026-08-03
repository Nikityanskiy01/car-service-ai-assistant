import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  DUMMY_PASSWORD_HASH,
  INVALID_CREDENTIALS_MESSAGE,
  normalizeAuthEmail,
  REGISTRATION_FAILED_MESSAGE,
} from '../../lib/authSecurity.js';
import {
  isSmtpConfigured,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '../../lib/mail/mail.service.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';

const SALT_ROUNDS = 12;
const MAX_REFRESH_SESSIONS = 10;

export const PASSWORD_RESET_GENERIC_MESSAGE =
  'Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля.';

export const RESEND_VERIFICATION_GENERIC_MESSAGE =
  'Если аккаунт с таким email существует и не подтверждён, мы отправили новый код.';

export const REGISTRATION_PENDING_MESSAGE =
  'Мы отправили код подтверждения на ваш email. Введите его для завершения регистрации.';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateVerificationCode() {
  return String(crypto.randomInt(100_000, 1_000_000));
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

function clientRequiresEmailVerification(user) {
  return user.role === 'CLIENT' && !user.emailVerifiedAt;
}

function toPublicUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    emailProfile: u.emailProfile,
    avatarUrl: u.avatarUrl ? '/api/users/me/avatar' : null,
    city: u.city,
    telegram: u.telegram,
    preferredContact: u.preferredContact,
    createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
  };
}

async function pruneRefreshSessions(userId) {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: MAX_REFRESH_SESSIONS,
  });
  if (!sessions.length) return;
  await prisma.refreshToken.deleteMany({
    where: { id: { in: sessions.map((s) => s.id) } },
  });
}

async function issueVerificationCode(user) {
  const env = getEnv();
  if (!isSmtpConfigured() && env.NODE_ENV !== 'test') {
    throw new AppError(503, 'Сервис отправки писем временно недоступен', 'SERVICE_UNAVAILABLE');
  }

  const code = generateVerificationCode();
  const codeHash = hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);
  const verifyUrl = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(user.email)}`;

  await prisma.emailVerificationCode.upsert({
    where: { userId: user.id },
    create: { userId: user.id, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0 },
  });

  await sendEmailVerificationEmail({
    to: user.email,
    code,
    userName: user.fullName,
    ttlMinutes: env.EMAIL_VERIFICATION_CODE_TTL_MINUTES,
    verifyUrl,
  });
}

export async function register({ email, password, fullName, phone }) {
  const normalizedEmail = normalizeAuthEmail(email);
  const trimmedName = String(fullName || '').trim();
  const digits = normalizePhone(phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing?.emailVerifiedAt) {
    throw new AppError(400, REGISTRATION_FAILED_MESSAGE, 'REGISTRATION_FAILED');
  }

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        fullName: trimmedName,
        phone: digits,
      },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  } else {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: trimmedName,
        phone: digits,
        role: 'CLIENT',
      },
    });
  }

  await issueVerificationCode(user);

  return {
    requiresEmailVerification: true,
    message: REGISTRATION_PENDING_MESSAGE,
    email: maskEmail(user.email),
  };
}

export async function verifyEmail({ email, code }) {
  const normalizedEmail = normalizeAuthEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.blocked) {
    throw new AppError(400, 'Неверный или просроченный код подтверждения', 'BAD_REQUEST');
  }
  if (user.emailVerifiedAt) {
    return issueTokens(user);
  }

  const record = await prisma.emailVerificationCode.findUnique({ where: { userId: user.id } });
  const env = getEnv();
  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await prisma.emailVerificationCode.delete({ where: { id: record.id } }).catch(() => {});
    }
    throw new AppError(400, 'Неверный или просроченный код подтверждения', 'BAD_REQUEST');
  }

  if (record.attempts >= env.EMAIL_VERIFICATION_MAX_ATTEMPTS) {
    await prisma.emailVerificationCode.delete({ where: { id: record.id } }).catch(() => {});
    throw new AppError(400, 'Превышено число попыток. Запросите новый код.', 'BAD_REQUEST');
  }

  const normalizedCode = String(code || '').trim();
  if (!/^\d{6}$/.test(normalizedCode) || hashVerificationCode(normalizedCode) !== record.codeHash) {
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(400, 'Неверный или просроченный код подтверждения', 'BAD_REQUEST');
  }

  const verified = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.emailVerificationCode.deleteMany({ where: { userId: user.id } });
    return updated;
  });

  return issueTokens(verified);
}

export async function resendVerificationEmail(email) {
  const normalizedEmail = normalizeAuthEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.blocked || user.emailVerifiedAt) {
    return { message: RESEND_VERIFICATION_GENERIC_MESSAGE };
  }

  try {
    await issueVerificationCode(user);
  } catch (e) {
    if (e instanceof AppError && e.code === 'SERVICE_UNAVAILABLE') throw e;
  }

  return { message: RESEND_VERIFICATION_GENERIC_MESSAGE };
}

export async function login({ email, password }) {
  const normalizedEmail = normalizeAuthEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok || user.blocked) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE, 'UNAUTHORIZED');
  }
  if (clientRequiresEmailVerification(user)) {
    throw new AppError(403, 'Подтвердите email для входа в личный кабинет', 'EMAIL_NOT_VERIFIED');
  }
  return issueTokens(user);
}

export async function refreshAccessToken(refreshTokenValue) {
  if (!refreshTokenValue) throw new AppError(401, 'Refresh token required', 'UNAUTHORIZED');

  const hashed = hashToken(refreshTokenValue);
  const record = await prisma.refreshToken.findUnique({ where: { token: hashed } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    throw new AppError(401, 'Refresh token expired or invalid', 'UNAUTHORIZED');
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.blocked || clientRequiresEmailVerification(user)) {
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    throw new AppError(401, 'User not found or blocked', 'UNAUTHORIZED');
  }

  await prisma.refreshToken.delete({ where: { id: record.id } });
  return issueTokens(user);
}

export async function logout(refreshTokenValue) {
  if (!refreshTokenValue) return;
  const hashed = hashToken(refreshTokenValue);
  await prisma.refreshToken.deleteMany({ where: { token: hashed } });
}

export async function requestPasswordReset(email) {
  const normalizedEmail = normalizeAuthEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.blocked) return { message: PASSWORD_RESET_GENERIC_MESSAGE };

  const env = getEnv();
  if (!isSmtpConfigured() && env.NODE_ENV !== 'test') {
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    }),
  ]);

  const resetUrl = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/reset-password#token=${encodeURIComponent(rawToken)}`;
  await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
    userName: user.fullName,
    ttlMinutes: env.PASSWORD_RESET_TOKEN_TTL_MINUTES,
  });

  return { message: PASSWORD_RESET_GENERIC_MESSAGE };
}

export async function resetPassword({ token, password }) {
  const hashed = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashed },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    }
    throw new AppError(400, 'Ссылка для сброса пароля недействительна или устарела', 'BAD_REQUEST');
  }

  if (record.user.blocked) {
    throw new AppError(400, 'Ссылка для сброса пароля недействительна или устарела', 'BAD_REQUEST');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  invalidateAuthUserCache(record.userId);

  return { ok: true };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) {
    throw new AppError(400, 'Неверный текущий пароль', 'BAD_REQUEST');
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError(400, 'Неверный текущий пароль', 'BAD_REQUEST');
  }

  if (currentPassword === newPassword) {
    throw new AppError(400, 'Новый пароль должен отличаться от текущего', 'BAD_REQUEST');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  await prisma.refreshToken.deleteMany({ where: { userId } });
  invalidateAuthUserCache(userId);

  return issueTokens(updated);
}

async function issueTokens(user) {
  const env = getEnv();
  const tokenVersion = user.tokenVersion ?? 0;
  const accessToken = jwt.sign({ sub: user.id, tv: tokenVersion }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const refreshTokenValue = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, token: hashToken(refreshTokenValue), expiresAt },
  });
  await pruneRefreshSessions(user.id);

  return { accessToken, refreshToken: refreshTokenValue, user: toPublicUser(user) };
}
