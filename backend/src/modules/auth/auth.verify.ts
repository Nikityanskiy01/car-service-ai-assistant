import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { normalizeAuthEmail, REGISTRATION_FAILED_MESSAGE } from '../../lib/authSecurity.js';
import { isSmtpConfigured, sendEmailVerificationEmail } from '../../lib/mail/mail.service.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { recordConsentEvent } from '../privacy/consent.service.js';
import {
  SALT_ROUNDS,
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  maskEmail,
  issueTokens,
} from './auth.shared.js';
import type { EmailCodeInput, RegisterInput, SessionMeta } from './auth.types.js';

export const RESEND_VERIFICATION_GENERIC_MESSAGE =
  'Если аккаунт с таким email существует и не подтверждён, мы отправили новый код.';

export const REGISTRATION_PENDING_MESSAGE =
  'Мы отправили код подтверждения на ваш email. Введите его для завершения регистрации.';

async function issueVerificationCode(user: Pick<User, 'id' | 'email' | 'fullName'>) {
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

export async function register({ email, password, fullName, phone }: RegisterInput, meta: SessionMeta = {}) {
  const normalizedEmail = normalizeAuthEmail(email);
  const trimmedName = String(fullName || '').trim();
  const digits = normalizePhone(phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing?.emailVerifiedAt) {
    throw new AppError(400, REGISTRATION_FAILED_MESSAGE, 'REGISTRATION_FAILED');
  }

  if (existing) {
    return {
      requiresEmailVerification: true,
      message: REGISTRATION_PENDING_MESSAGE,
    };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      fullName: trimmedName,
      phone: digits,
      role: 'CLIENT',
    },
  });

  await issueVerificationCode(user);
  await recordConsentEvent({
    userId: user.id,
    subjectKey: normalizedEmail,
    purpose: 'registration',
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    requiresEmailVerification: true,
    message: REGISTRATION_PENDING_MESSAGE,
    email: maskEmail(user.email),
  };
}

export async function verifyEmail({ email, code }: EmailCodeInput) {
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
  if (!/^\d{6}$/.test(normalizedCode) || !verificationCodeMatches(record.codeHash, normalizedCode)) {
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

export async function resendVerificationEmail(email: string) {
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
