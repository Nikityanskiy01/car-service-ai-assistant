import QRCode from 'qrcode';
import type { User } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { signAppJwt, verifyAppJwt } from '../../lib/jwtTokens.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { assertNotLocked, recordFailedLogin, clearFailedLogins } from '../../lib/accountLockout.js';
import { getRedis } from '../../lib/redis.js';
import {
  buildOtpAuthUrl,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  backupCodeMatches,
  normalizeBackupCode,
  verifyTotpToken,
} from '../../lib/totp.js';
import { recordLoginEvent } from './security.events.js';
import type { SessionMeta } from '../auth/auth.types.js';

const PENDING_SETUP_TTL_MS = 15 * 60 * 1000;

type PendingTotpSetup = {
  secret: string;
  backupCodes: string[];
  expiresAt: number;
};

type DisableTotpInput = {
  password: string;
  code: string;
  confirmPhrase?: string;
};

type PasswordAndCodeInput = {
  password: string;
  code?: string;
};

type TotpChallengeJwt = {
  sub?: string;
  purpose?: string;
};

/** Fallback only when Redis is unavailable (tests / local without REDIS_URL). */
const memoryPendingSetups = new Map<string, { encoded: string; expiresAt: number }>();

function totpSetupKey(userId: string) {
  return `totp-setup:${userId}`;
}

async function savePendingSetup(userId: string, payload: PendingTotpSetup) {
  const encoded = encryptSecret(JSON.stringify(payload));
  const redis = getRedis();
  if (redis) {
    await redis.set(totpSetupKey(userId), encoded, 'PX', PENDING_SETUP_TTL_MS);
    return;
  }
  if (getEnv().NODE_ENV === 'production') {
    throw new AppError(503, 'Сервис временно недоступен', 'UNAVAILABLE');
  }
  memoryPendingSetups.set(userId, { encoded, expiresAt: payload.expiresAt });
}

async function readPendingSetup(userId: string): Promise<PendingTotpSetup | null> {
  const redis = getRedis();
  let encoded = null;
  if (redis) {
    encoded = await redis.get(totpSetupKey(userId));
  } else {
    const row = memoryPendingSetups.get(userId);
    if (row && row.expiresAt > Date.now()) encoded = row.encoded;
    else memoryPendingSetups.delete(userId);
  }
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(decryptSecret(encoded)) as PendingTotpSetup;
    if (!parsed?.secret || Number(parsed.expiresAt) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function deletePendingSetup(userId: string) {
  const redis = getRedis();
  if (redis) await redis.del(totpSetupKey(userId));
  memoryPendingSetups.delete(userId);
}
export async function beginTotpSetup(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (user.totpEnabledAt) {
    throw new AppError(400, 'Дополнительная защита уже включена', 'BAD_REQUEST');
  }

  const secret = generateTotpSecret();
  const backupCodes = generateBackupCodes(8);
  await savePendingSetup(userId, { secret, backupCodes, expiresAt: Date.now() + PENDING_SETUP_TTL_MS });

  const env = getEnv();
  const issuer = 'Автосервис';
  const otpauthUrl = buildOtpAuthUrl({ secret, email: user.email, issuer });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: { dark: '#111827', light: '#ffffff' },
  });

  return {
    secret,
    otpauthUrl,
    qrDataUrl,
    issuer,
    account: user.email,
    appPublicUrl: env.APP_PUBLIC_URL,
    backupCodes,
  };
}

export async function abortTotpSetup(userId: string) {
  await deletePendingSetup(userId);
  return { ok: true };
}

export async function confirmTotpSetup(userId: string, code: string) {
  const pending = await readPendingSetup(userId);
  if (!pending) {
    await deletePendingSetup(userId);
    throw new AppError(400, 'Время на настройку истекло. Начните заново.', 'BAD_REQUEST');
  }
  if (!verifyTotpToken(pending.secret, code)) {
    throw new AppError(400, 'Неверный код из приложения', 'BAD_REQUEST');
  }

  const backupCodes = pending.backupCodes?.length ? pending.backupCodes : generateBackupCodes(8);
  const backupHashes = backupCodes.map(hashBackupCode);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEnc: encryptSecret(pending.secret),
      totpEnabledAt: new Date(),
      totpBackupHashes: backupHashes,
      tokenVersion: { increment: 1 },
    },
  });
  await deletePendingSetup(userId);
  invalidateAuthUserCache(userId);

  return { ok: true, backupCodes, user: updated };
}

export async function disableTotp(userId: string, { password, code, confirmPhrase }: DisableTotpInput, meta: SessionMeta = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (!user.totpEnabledAt || !user.totpSecretEnc) {
    throw new AppError(400, 'Дополнительная защита не включена', 'BAD_REQUEST');
  }
  if (getEnv().STAFF_2FA_REQUIRED && (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR')) {
    throw new AppError(400, 'Для сотрудников двухфакторная защита обязательна', 'TOTP_REQUIRED');
  }

  const phrase = String(confirmPhrase || '')
    .trim()
    .toUpperCase();
  if (phrase !== 'УДАЛИТЬ') {
    throw new AppError(400, 'Чтобы отключить защиту, введите слово УДАЛИТЬ', 'BAD_REQUEST');
  }

  const ok = await checkPasswordAndSecondFactor(user, password, code);
  if (!ok) {
    await recordLoginEvent({
      userId,
      success: false,
      method: 'totp_disable',
      reason: 'bad_disable',
      ...meta,
    });
    throw new AppError(400, 'Неверный пароль или код подтверждения', 'BAD_REQUEST');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEnc: null,
      totpEnabledAt: null,
      totpBackupHashes: [],
      tokenVersion: { increment: 1 },
    },
  });
  invalidateAuthUserCache(userId);
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await deletePendingSetup(userId);
  await recordLoginEvent({
    userId,
    success: true,
    method: 'totp_disable',
    ...meta,
  });

  return { ok: true };
}

export async function regenerateBackupCodes(userId: string, { password, code }: PasswordAndCodeInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (!user.totpEnabledAt || !user.totpSecretEnc) {
    throw new AppError(400, 'Дополнительная защита не включена', 'BAD_REQUEST');
  }

  await assertPasswordAndSecondFactor(user, password, String(code || ''));

  const backupCodes = generateBackupCodes(8);
  await prisma.user.update({
    where: { id: userId },
    data: { totpBackupHashes: backupCodes.map(hashBackupCode) },
  });
  invalidateAuthUserCache(userId);

  return { ok: true, backupCodes };
}

async function checkPasswordAndSecondFactor(user: User, password: string, code: string) {
  const bcrypt = (await import('bcryptjs')).default;
  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) return false;

  const secret = decryptSecret(user.totpSecretEnc);
  if (verifyTotpToken(secret, code)) return true;
  return user.totpBackupHashes.some((h) => backupCodeMatches(h, code));
}

async function assertPasswordAndSecondFactor(user: User, password: string, code: string) {
  const ok = await checkPasswordAndSecondFactor(user, password, code);
  if (!ok) throw new AppError(400, 'Неверный пароль или код подтверждения', 'BAD_REQUEST');
}

export async function assertSensitiveAction(user: User, { password, code = '' }: PasswordAndCodeInput) {
  const bcrypt = (await import('bcryptjs')).default;
  const passwordOk = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!passwordOk) {
    throw new AppError(400, 'Неверный пароль', 'BAD_REQUEST');
  }

  if (!user.totpEnabledAt || !user.totpSecretEnc) return;

  const normalizedCode = String(code || '').trim();
  const secret = decryptSecret(user.totpSecretEnc);
  const secondFactorOk =
    verifyTotpToken(secret, normalizedCode) ||
    user.totpBackupHashes.some((hash) => backupCodeMatches(hash, normalizedCode));

  if (!secondFactorOk) {
    throw new AppError(400, 'Неверный код подтверждения', 'BAD_REQUEST');
  }
}

export function createTotpChallengeToken(userId: string) {
  return signAppJwt({ sub: userId, purpose: '2fa' }, { expiresIn: '5m' });
}

export async function verifyTotpChallenge(challengeToken: string, code: string, meta: SessionMeta = {}) {
  let payload: TotpChallengeJwt;
  try {
    payload = verifyAppJwt(challengeToken) as TotpChallengeJwt;
  } catch {
    throw new AppError(401, 'Сессия подтверждения истекла. Войдите снова.', 'UNAUTHORIZED');
  }
  if (!payload?.sub || payload.purpose !== '2fa') {
    throw new AppError(401, 'Недействительный токен подтверждения', 'UNAUTHORIZED');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.blocked || !user.totpEnabledAt || !user.totpSecretEnc) {
    throw new AppError(401, 'Недействительный токен подтверждения', 'UNAUTHORIZED');
  }
  await assertNotLocked(user);

  const secret = decryptSecret(user.totpSecretEnc);
  let method = 'totp';
  let nextBackupHashes = user.totpBackupHashes;

  if (verifyTotpToken(secret, code)) {
    method = 'totp';
  } else {
    const normalized = normalizeBackupCode(code);
    const idx = user.totpBackupHashes.findIndex((h) => backupCodeMatches(h, normalized));
    if (idx < 0) {
      await recordLoginEvent({
        userId: user.id,
        success: false,
        method: 'totp',
        reason: 'bad_totp',
        ...meta,
      });
      await recordFailedLogin(user.id);
      throw new AppError(401, 'Неверный код', 'UNAUTHORIZED');
    }
    method = 'backup';
    nextBackupHashes = user.totpBackupHashes.filter((_, i) => i !== idx);
    await prisma.user.update({
      where: { id: user.id },
      data: { totpBackupHashes: nextBackupHashes },
    });
  }

  await clearFailedLogins(user.id);
  await recordLoginEvent({
    userId: user.id,
    success: true,
    method,
    ...meta,
  });

  return user;
}

