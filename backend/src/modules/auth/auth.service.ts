import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  DUMMY_PASSWORD_HASH,
  INVALID_CREDENTIALS_MESSAGE,
  normalizeAuthEmail,
} from '../../lib/authSecurity.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { assertNotLocked, clearFailedLogins, recordFailedLogin } from '../../lib/accountLockout.js';
import * as securityService from '../users/security.service.js';
import {
  hashToken,
  clientRequiresEmailVerification,
  issueTokens,
  REFRESH_REUSE_GRACE_MS,
} from './auth.shared.js';
import type { IssuedSession, LoginCredentials, LoginResult, SessionMeta, TotpLoginInput } from './auth.types.js';

export { PASSWORD_RESET_GENERIC_MESSAGE } from './auth.password.js';
export { RESEND_VERIFICATION_GENERIC_MESSAGE, REGISTRATION_PENDING_MESSAGE } from './auth.verify.js';
export { register, verifyEmail, resendVerificationEmail } from './auth.verify.js';
export { requestPasswordReset, resetPassword, changePassword } from './auth.password.js';
export { issueSession } from './auth.shared.js';

export async function login({ identifier, email, password }: LoginCredentials, meta: SessionMeta = {}): Promise<LoginResult> {
  const rawIdentifier = String(identifier || email || '').trim();
  let user = null;

  if (rawIdentifier.includes('@')) {
    const normalizedEmail = normalizeAuthEmail(rawIdentifier);
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  } else {
    const phone = normalizePhone(rawIdentifier);
    if (isValidPhoneDigits(phone)) {
      user = await prisma.user.findFirst({
        where: { phone, phoneVerifiedAt: { not: null } },
      });
    }
  }

  const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (user && !user.blocked) {
    await assertNotLocked(user);
  }
  if (!user || !ok || user.blocked || clientRequiresEmailVerification(user)) {
    if (user && !user.blocked && !ok) {
      await recordFailedLogin(user.id);
      await securityService.recordLoginEvent({
        userId: user.id,
        success: false,
        method: 'password',
        reason: 'bad_password',
        ...meta,
      });
    }
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE, 'UNAUTHORIZED');
  }

  await clearFailedLogins(user.id);
  return completeVerifiedLogin(user, 'password', meta);
}

export async function completeVerifiedLogin(user: User, method: string, meta: SessionMeta = {}): Promise<LoginResult> {
  await assertNotLocked(user);
  if (clientRequiresEmailVerification(user)) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE, 'UNAUTHORIZED');
  }

  if (user.totpEnabledAt && user.totpSecretEnc) {
    return {
      requires2fa: true,
      challengeToken: securityService.createTotpChallengeToken(user.id),
    };
  }

  const staffNeedsTotp =
    getEnv().STAFF_2FA_REQUIRED &&
    (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR');

  await securityService.recordLoginEvent({
    userId: user.id,
    success: true,
    method,
    ...meta,
  });
  await clearFailedLogins(user.id);
  return issueTokens(user, { ...meta, totpSetupPending: staffNeedsTotp });
}

export async function loginWithTotp({ challengeToken, code }: TotpLoginInput, meta: SessionMeta = {}) {
  const user = await securityService.verifyTotpChallenge(challengeToken, code, meta);
  return issueTokens(user, meta);
}

export async function refreshAccessToken(refreshTokenValue: string, meta: SessionMeta = {}): Promise<IssuedSession> {
  if (!refreshTokenValue) throw new AppError(401, 'Требуется повторный вход. Обновите страницу.', 'UNAUTHORIZED');

  const hashed = hashToken(refreshTokenValue);
  const record = await prisma.refreshToken.findUnique({ where: { token: hashed } });
  if (!record || record.expiresAt < new Date()) {
    if (record?.consumedAt) {
      await prisma.refreshToken.deleteMany({ where: { familyId: record.familyId } });
      await prisma.user.update({
        where: { id: record.userId },
        data: { tokenVersion: { increment: 1 } },
      }).catch(() => {});
      invalidateAuthUserCache(record.userId);
    } else if (record) {
      await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    }
    throw new AppError(401, 'Сессия истекла. Войдите снова.', 'UNAUTHORIZED');
  }

  if (record.consumedAt) {
    const consumedAgo = Date.now() - new Date(record.consumedAt).getTime();
    if (consumedAgo > REFRESH_REUSE_GRACE_MS) {
      await prisma.refreshToken.deleteMany({ where: { familyId: record.familyId } });
      await prisma.user
        .update({
          where: { id: record.userId },
          data: { tokenVersion: { increment: 1 } },
        })
        .catch(() => {});
      invalidateAuthUserCache(record.userId);
      throw new AppError(401, 'Сессия истекла. Войдите снова.', 'UNAUTHORIZED');
    }
    const concurrentUser = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!concurrentUser || concurrentUser.blocked || clientRequiresEmailVerification(concurrentUser)) {
      await prisma.refreshToken.deleteMany({ where: { familyId: record.familyId } }).catch(() => {});
      throw new AppError(401, 'Пользователь не найден или заблокирован.', 'UNAUTHORIZED');
    }
    return issueTokens(concurrentUser, {
      ip: meta.ip || record.ip,
      userAgent: meta.userAgent || record.userAgent,
      familyId: record.familyId,
    });
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.blocked || clientRequiresEmailVerification(user)) {
    await prisma.refreshToken.deleteMany({ where: { familyId: record.familyId } }).catch(() => {});
    throw new AppError(401, 'Пользователь не найден или заблокирован.', 'UNAUTHORIZED');
  }

  const sessionMeta = {
    ip: meta.ip || record.ip,
    userAgent: meta.userAgent || record.userAgent,
    familyId: record.familyId,
  };
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return issueTokens(user, sessionMeta);
}

export async function logout(refreshTokenValue?: string | null) {
  if (!refreshTokenValue) return;
  const hashed = hashToken(refreshTokenValue);
  await prisma.refreshToken.deleteMany({ where: { token: hashed } });
}
