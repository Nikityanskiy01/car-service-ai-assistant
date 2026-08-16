import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { normalizeAuthEmail } from '../../lib/authSecurity.js';
import { isSmtpConfigured, sendPasswordResetEmail } from '../../lib/mail/mail.service.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { hashToken, SALT_ROUNDS, issueTokens } from './auth.shared.js';
import type { ChangePasswordInput, PasswordResetInput } from './auth.types.js';

export const PASSWORD_RESET_GENERIC_MESSAGE =
  'Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля.';

export async function requestPasswordReset(email: string) {
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

export async function resetPassword({ token, password }: PasswordResetInput) {
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

export async function changePassword(userId: string, { currentPassword, newPassword }: ChangePasswordInput) {
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
