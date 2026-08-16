import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  deviceSessionKey,
  enrichClientMeta,
  hashRefreshToken,
  isScriptUserAgent,
} from '../../lib/clientMeta.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { isSmtpConfigured, sendSessionRevokeEmail } from '../../lib/mail/mail.service.js';
import {
  assertOtpCooldown,
  consumeOtpChallenge,
  createOtpChallenge,
  generateNumericOtp,
  maskEmail,
} from '../../lib/otp/otpChallenge.js';

const SESSION_REVOKE_PURPOSE = 'revoke_sessions';

function isCurrentSession(row, currentHash, sessionId) {
  if (sessionId && row.id === sessionId) return true;
  if (currentHash && row.token === currentHash) return true;
  return false;
}

function mapSessionRow(row, current) {
  const meta = enrichClientMeta({ ip: row.ip, userAgent: row.userAgent });
  const lastUsedAt = row.lastUsedAt ?? row.createdAt;
  return {
    id: row.id,
    current,
    device: meta.device,
    ip: row.ip,
    ipLabel: meta.ipLabel,
    ipKind: meta.ipKind,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: lastUsedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

function staleDuplicateIds(rows, currentId) {
  const kept = new Set();
  const stale = [];
  const ordered = [...rows].sort((a, b) => {
    if (currentId) {
      if (a.id === currentId) return -1;
      if (b.id === currentId) return 1;
    }
    const aTime = (a.lastUsedAt ?? a.createdAt).getTime();
    const bTime = (b.lastUsedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
  for (const row of ordered) {
    const key = deviceSessionKey(row.ip, row.userAgent);
    if (kept.has(key)) {
      stale.push(row.id);
      continue;
    }
    kept.add(key);
  }
  return stale;
}

async function loadLiveSessions(userId) {
  const now = new Date();
  return prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: now }, consumedAt: null },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

function resolveListContext(input) {
  if (typeof input === 'string') return { refreshToken: input };
  return input || {};
}

function leftoverScriptIds(rows, currentId, includeScripts) {
  if (includeScripts) return [];
  return rows
    .filter((row) => row.id !== currentId && isScriptUserAgent(row.userAgent))
    .map((row) => row.id);
}

export async function listActiveSessions(userId, input = null) {
  const context = resolveListContext(input);
  const currentHash = context.refreshToken ? hashRefreshToken(context.refreshToken) : null;
  const rows = await loadLiveSessions(userId);
  const currentId =
    rows.find((row) => isCurrentSession(row, currentHash, context.sessionId))?.id ||
    rows.find((row) => {
      if (!context.requestUserAgent) return false;
      return deviceSessionKey(row.ip, row.userAgent) === deviceSessionKey(context.requestIp, context.requestUserAgent);
    })?.id ||
    null;
  const stale = [
    ...staleDuplicateIds(rows, currentId),
    ...leftoverScriptIds(rows, currentId, context.includeScripts),
  ];
  if (stale.length) {
    await prisma.refreshToken.deleteMany({ where: { id: { in: stale } } });
  }
  return rows
    .filter((row) => !stale.includes(row.id))
    .map((row) => mapSessionRow(row, row.id === currentId))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function listAllActiveSessions(input = null) {
  const context = { includeScripts: true, ...resolveListContext(input) };
  const currentHash = context.refreshToken ? hashRefreshToken(context.refreshToken) : null;
  const now = new Date();
  const rows = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: now }, consumedAt: null },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    take: 300,
    include: {
      user: { select: { id: true, email: true, fullName: true, role: true, blocked: true } },
    },
  });
  return rows.map((row) => ({
    ...mapSessionRow(row, isCurrentSession(row, currentHash, context.sessionId)),
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
export async function startSessionRevokeChallenge(
  userId: string,
  input: { scope?: string; sessionId?: string | null } = {},
) {
  const scope = input.scope || 'others';
  const sessionId = input.sessionId || null;
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

export async function revokeSession(
  userId: string,
  sessionId: string,
  currentRefreshTokenValue: string | null = null,
  extra: { code?: string; currentSessionId?: string | null } = {},
) {
  const currentHash = currentRefreshTokenValue ? hashRefreshToken(currentRefreshTokenValue) : null;
  const row = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId },
  });
  if (!row) throw new AppError(404, 'Сессия не найдена', 'NOT_FOUND');

  await consumeSessionRevokeCode(userId, extra.code);

  await prisma.refreshToken.delete({ where: { id: row.id } });
  return {
    ok: true,
    currentRevoked: isCurrentSession(row, currentHash, extra.currentSessionId),
  };
}

export async function revokeOtherSessions(
  userId: string,
  currentRefreshTokenValue: string | null,
  extra: { code?: string; currentSessionId?: string | null } = {},
) {
  const currentHash = currentRefreshTokenValue ? hashRefreshToken(currentRefreshTokenValue) : null;
  const currentSessionId = extra.currentSessionId || null;
  if (!currentHash && !currentSessionId) {
    throw new AppError(400, 'Не удалось определить текущую сессию', 'BAD_REQUEST');
  }
  await consumeSessionRevokeCode(userId, extra.code);

  const result = await prisma.refreshToken.deleteMany({
    where: {
      userId,
      ...(currentSessionId
        ? { NOT: { id: currentSessionId } }
        : { NOT: { token: currentHash } }),
    },
  });
  return { ok: true, revoked: result.count };
}
