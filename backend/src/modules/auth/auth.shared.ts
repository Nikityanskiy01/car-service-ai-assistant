import crypto from 'crypto';
import type { User } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import {
  deviceSessionKey,
  hashRefreshToken,
  isScriptUserAgent,
} from '../../lib/clientMeta.js';
import { hmacHex, sha256Hex, timingSafeEqualHex } from '../../lib/cryptoHash.js';
import { signAppJwt } from '../../lib/jwtTokens.js';
import type { IssuedSession, PublicUser, SessionMeta } from './auth.types.js';

export const SALT_ROUNDS = 12;
const MAX_REFRESH_SESSIONS = 10;
export const REFRESH_REUSE_GRACE_MS = 30_000;

export function hashToken(token: string) {
  return hashRefreshToken(token);
}

export function hashVerificationCode(code: string) {
  return hmacHex('email-verify', String(code));
}

export function verificationCodeMatches(storedHash: string, code: string) {
  const normalized = String(code || '').trim();
  if (timingSafeEqualHex(storedHash, hashVerificationCode(normalized))) return true;
  return timingSafeEqualHex(storedHash, sha256Hex(normalized));
}

export function generateVerificationCode() {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

export function clientRequiresEmailVerification(user: Pick<User, 'role' | 'emailVerifiedAt'>) {
  return user.role === 'CLIENT' && !user.emailVerifiedAt;
}

export function toPublicUser(u: User): PublicUser {
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
    totpEnabled: Boolean(u.totpEnabledAt),
    emailVerified: Boolean(u.emailVerifiedAt),
    phoneVerified: Boolean(u.phoneVerifiedAt),
    telegramLinked: Boolean(u.telegramChatId),
  };
}

export async function pruneRefreshSessions(userId: string) {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: MAX_REFRESH_SESSIONS,
  });
  if (!sessions.length) return;
  await prisma.refreshToken.deleteMany({
    where: { id: { in: sessions.map((s) => s.id) } },
  });
}

/** Повторный вход с того же браузера/IP заменяет старую сессию и убирает скрипты. */
export async function replaceMatchingDeviceSessions(userId: string, meta: SessionMeta = {}) {
  const incomingUa = meta.userAgent ? String(meta.userAgent).slice(0, 500) : '';
  const incomingKey = incomingUa ? deviceSessionKey(meta.ip, incomingUa) : null;
  const live = await prisma.refreshToken.findMany({
    where: { userId, consumedAt: null },
    select: { id: true, ip: true, userAgent: true },
  });
  const staleIds = live
    .filter((row) => {
      if (isScriptUserAgent(row.userAgent)) return true;
      if (!incomingKey) return false;
      return deviceSessionKey(row.ip, row.userAgent) === incomingKey;
    })
    .map((row) => row.id);
  if (!staleIds.length) return;
  await prisma.refreshToken.deleteMany({ where: { id: { in: staleIds } } });
}

export async function issueTokens(user: User, meta: SessionMeta = {}): Promise<IssuedSession> {
  const env = getEnv();
  const tokenVersion = user.tokenVersion ?? 0;
  if (!meta.familyId) {
    await replaceMatchingDeviceSessions(user.id, meta);
  }

  const refreshTokenValue = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const familyId = meta.familyId || crypto.randomUUID();
  const row = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashToken(refreshTokenValue),
      familyId,
      expiresAt,
      ip: meta.ip ? String(meta.ip).slice(0, 64) : null,
      userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 500) : null,
      lastUsedAt: now,
    },
  });
  const accessToken = signAppJwt(
    {
      sub: user.id,
      tv: tokenVersion,
      sid: row.id,
      ...(meta.totpSetupPending ? { stp: 1 } : {}),
    },
    { expiresIn: env.JWT_EXPIRES_IN },
  );
  await pruneRefreshSessions(user.id);

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    user: toPublicUser(user),
    totpSetupPending: Boolean(meta.totpSetupPending),
  };
}

export async function issueSession(user: User, meta: SessionMeta = {}) {
  return issueTokens(user, meta);
}
