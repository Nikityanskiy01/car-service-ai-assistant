import QRCode from 'qrcode';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { signAppJwt, verifyAppJwt } from '../../lib/jwtTokens.js';
import {
  enrichClientMeta,
  hashRefreshToken,
  loginMethodLabel,
  loginReasonLabel,
} from '../../lib/clientMeta.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { isSmtpConfigured, sendSessionRevokeEmail } from '../../lib/mail/mail.service.js';
import { assertNotLocked, recordFailedLogin, clearFailedLogins } from '../../lib/accountLockout.js';
import { getRedis } from '../../lib/redis.js';
import {
  assertOtpCooldown,
  consumeOtpChallenge,
  createOtpChallenge,
  generateNumericOtp,
  maskEmail,
} from '../../lib/otp/otpChallenge.js';
import { isSmsConfigured } from '../../lib/sms/sms.service.js';
import { getTelegramBotInfo, isTelegramConfigured } from '../notifications/telegramAuth.bot.js';
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

const MAX_LOGIN_EVENTS = 50;
const PENDING_SETUP_TTL_MS = 15 * 60 * 1000;
const SESSION_REVOKE_PURPOSE = 'revoke_sessions';

/** Fallback only when Redis is unavailable (tests / local without REDIS_URL). */
const memoryPendingSetups = new Map();

function totpSetupKey(userId) {
  return `totp-setup:${userId}`;
}

async function savePendingSetup(userId, payload) {
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

async function readPendingSetup(userId) {
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
    const parsed = JSON.parse(decryptSecret(encoded));
    if (!parsed?.secret || Number(parsed.expiresAt) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function deletePendingSetup(userId) {
  const redis = getRedis();
  if (redis) await redis.del(totpSetupKey(userId));
  memoryPendingSetups.delete(userId);
}

export async function recordLoginEvent({
  userId,
  success,
  method = 'password',
  ip = null,
  userAgent = null,
  reason = null,
}: any) {
  if (!userId) return;
  try {
    await prisma.userLoginEvent.create({
      data: {
        userId,
        success: Boolean(success),
        method,
        ip: ip ? String(ip).slice(0, 64) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        reason: reason ? String(reason).slice(0, 120) : null,
      },
    });
    const old = await prisma.userLoginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_LOGIN_EVENTS,
      select: { id: true },
    });
    if (old.length) {
      await prisma.userLoginEvent.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
  } catch {
    // history must never break auth
  }
}

export async function getSecurityStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      telegram: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      telegramChatId: true,
      telegramLinkedAt: true,
      totpEnabledAt: true,
      totpBackupHashes: true,
      loginEmailOtpEnabled: true,
      loginSmsEnabled: true,
      loginTelegramEnabled: true,
    },
  });
  if (!user) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const bot = await getTelegramBotInfo();
  const env = getEnv();
  return {
    totpEnabled: Boolean(user.totpEnabledAt),
    totpEnabledAt: user.totpEnabledAt?.toISOString?.() ?? null,
    backupRemaining: Array.isArray(user.totpBackupHashes) ? user.totpBackupHashes.length : 0,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString?.() ?? null,
    telegram: user.telegram,
    telegramLinked: Boolean(user.telegramChatId),
    telegramLinkedAt: user.telegramLinkedAt?.toISOString?.() ?? null,
    telegramBotUsername: bot.username,
    loginMethods: {
      password: true,
      emailOtp: Boolean(user.loginEmailOtpEnabled),
      sms: Boolean(user.loginSmsEnabled),
      telegram: Boolean(user.loginTelegramEnabled),
    },
    channels: {
      emailConfigured: isSmtpConfigured() || env.NODE_ENV === 'test',
      smsConfigured: isSmsConfigured(),
      telegramConfigured: isTelegramConfigured() || env.NODE_ENV === 'test',
    },
  };
}

export async function listLoginHistory(userId, limit = 20) {
  const take = Math.min(50, Math.max(1, Number(limit) || 20));
  const rows = await prisma.userLoginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map((row) => {
    const meta = enrichClientMeta({ ip: row.ip, userAgent: row.userAgent });
    return {
      id: row.id,
      success: row.success,
      method: row.method,
      methodLabel: loginMethodLabel(row.method),
      ip: row.ip,
      ipLabel: meta.ipLabel,
      ipKind: meta.ipKind,
      userAgent: row.userAgent,
      device: meta.device,
      reason: row.reason,
      reasonLabel: loginReasonLabel(row.reason),
      createdAt: row.createdAt.toISOString(),
    };
  });
}

function mapSessionRow(row, currentHash) {
  const meta = enrichClientMeta({ ip: row.ip, userAgent: row.userAgent });
  const lastUsedAt = row.lastUsedAt ?? row.createdAt;
  return {
    id: row.id,
    current: currentHash ? row.token === currentHash : false,
    device: meta.device,
    ip: row.ip,
    ipLabel: meta.ipLabel,
    ipKind: meta.ipKind,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: lastUsedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function listActiveSessions(userId, currentRefreshTokenValue = null) {
  const now = new Date();
  const currentHash = currentRefreshTokenValue ? hashRefreshToken(currentRefreshTokenValue) : null;
  const rows = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: now }, consumedAt: null },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((row) => mapSessionRow(row, currentHash));
}

export async function listAllActiveSessions(currentRefreshTokenValue = null) {
  const now = new Date();
  const currentHash = currentRefreshTokenValue ? hashRefreshToken(currentRefreshTokenValue) : null;
  const rows = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: now }, consumedAt: null },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    take: 300,
    include: {
      user: { select: { id: true, email: true, fullName: true, role: true, blocked: true } },
    },
  });
  return rows.map((row) => ({
    ...mapSessionRow(row, currentHash),
    user: row.user,
  }));
}

export async function revokeAnySession(sessionId) {
  const row = await prisma.refreshToken.findUnique({ where: { id: sessionId } });
  if (!row) throw new AppError(404, 'Сессия не найдена', 'NOT_FOUND');
  await prisma.refreshToken.delete({ where: { id: row.id } });
  return { ok: true, userId: row.userId };
}

export async function revokeAllUserSessions(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError(404, 'Пользователь не найден', 'NOT_FOUND');
  const result = await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  invalidateAuthUserCache(userId);
  return { ok: true, revoked: result.count };
}

/**
 * Завершение сессий подтверждается одноразовым кодом с почты: одного пароля мало,
 * если устройство уже угнали вместе с активной сессией.
 */
export async function startSessionRevokeChallenge(userId, { scope = 'others', sessionId = null }: any = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  let targetLabel = 'все другие устройства';
  if (scope === 'one') {
    if (!sessionId) throw new AppError(400, 'Не указана сессия', 'BAD_REQUEST');
    const row = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
    if (!row) throw new AppError(404, 'Сессия не найдена', 'NOT_FOUND');
    const meta = enrichClientMeta({ ip: row.ip, userAgent: row.userAgent });
    targetLabel = meta.device?.label || 'выбранное устройство';
  }

  const env = getEnv();
  if (!isSmtpConfigured() && env.NODE_ENV !== 'test') {
    throw new AppError(503, 'Сервис отправки писем временно недоступен', 'SERVICE_UNAVAILABLE');
  }

  await assertOtpCooldown(userId, SESSION_REVOKE_PURPOSE, 'email');
  const code = generateNumericOtp();
  await createOtpChallenge({
    userId,
    purpose: SESSION_REVOKE_PURPOSE,
    channel: 'email',
    destination: user.email,
    code,
  });

  await sendSessionRevokeEmail({
    to: user.email,
    code,
    userName: user.fullName,
    ttlMinutes: env.OTP_CODE_TTL_MINUTES,
    targetLabel,
  });

  return {
    scope: scope === 'one' ? 'one' : 'others',
    targetLabel,
    destinationHint: maskEmail(user.email),
    expiresInSec: env.OTP_CODE_TTL_MINUTES * 60,
    resendAfterSec: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

async function consumeSessionRevokeCode(userId, code) {
  const normalized = String(code ?? '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new AppError(400, 'Введите код из письма', 'OTP_REQUIRED');
  }

  const pending = await prisma.authOtpChallenge.findFirst({
    where: {
      userId,
      purpose: SESSION_REVOKE_PURPOSE,
      channel: 'email',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!pending) {
    throw new AppError(400, 'Код устарел. Запросите новый.', 'OTP_REQUIRED');
  }

  await consumeOtpChallenge(pending.token, normalized, { purpose: SESSION_REVOKE_PURPOSE });
}

export async function revokeSession(userId, sessionId, currentRefreshTokenValue = null, { code }: any = {}) {
  const currentHash = currentRefreshTokenValue ? hashRefreshToken(currentRefreshTokenValue) : null;
  const row = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId },
  });
  if (!row) throw new AppError(404, 'Сессия не найдена', 'NOT_FOUND');

  await consumeSessionRevokeCode(userId, code);

  await prisma.refreshToken.delete({ where: { id: row.id } });
  return {
    ok: true,
    currentRevoked: Boolean(currentHash && row.token === currentHash),
  };
}

export async function revokeOtherSessions(userId, currentRefreshTokenValue, { code }: any = {}) {
  if (!currentRefreshTokenValue) {
    throw new AppError(400, 'Не удалось определить текущую сессию', 'BAD_REQUEST');
  }
  await consumeSessionRevokeCode(userId, code);

  const currentHash = hashRefreshToken(currentRefreshTokenValue);
  const result = await prisma.refreshToken.deleteMany({
    where: {
      userId,
      NOT: { token: currentHash },
    },
  });
  return { ok: true, revoked: result.count };
}

export async function beginTotpSetup(userId) {
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

export async function abortTotpSetup(userId) {
  await deletePendingSetup(userId);
  return { ok: true };
}

export async function confirmTotpSetup(userId, code) {
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

export async function disableTotp(userId, { password, code, confirmPhrase }, meta: any = {}) {
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

export async function regenerateBackupCodes(userId, { password, code }: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (!user.totpEnabledAt || !user.totpSecretEnc) {
    throw new AppError(400, 'Дополнительная защита не включена', 'BAD_REQUEST');
  }

  await assertPasswordAndSecondFactor(user, password, code);

  const backupCodes = generateBackupCodes(8);
  await prisma.user.update({
    where: { id: userId },
    data: { totpBackupHashes: backupCodes.map(hashBackupCode) },
  });
  invalidateAuthUserCache(userId);

  return { ok: true, backupCodes };
}

async function checkPasswordAndSecondFactor(user, password, code) {
  const bcrypt = (await import('bcryptjs')).default;
  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) return false;

  const secret = decryptSecret(user.totpSecretEnc);
  if (verifyTotpToken(secret, code)) return true;
  return user.totpBackupHashes.some((h) => backupCodeMatches(h, code));
}

async function assertPasswordAndSecondFactor(user, password, code) {
  const ok = await checkPasswordAndSecondFactor(user, password, code);
  if (!ok) throw new AppError(400, 'Неверный пароль или код подтверждения', 'BAD_REQUEST');
}

export async function assertSensitiveAction(user, { password, code = '' }: any) {
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

export function createTotpChallengeToken(userId) {
  return signAppJwt({ sub: userId, purpose: '2fa' }, { expiresIn: '5m' });
}

export async function verifyTotpChallenge(challengeToken, code, meta: any = {}) {
  let payload;
  try {
    payload = verifyAppJwt(challengeToken);
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

