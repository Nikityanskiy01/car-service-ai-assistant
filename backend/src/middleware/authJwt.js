import { apiMessages } from '../config/apiMessages.js';
import { getEnv } from '../config/env.js';
import { readCookieValue } from '../lib/authCookies.js';
import { verifyAppJwt } from '../lib/jwtTokens.js';
import { createTtlCache } from '../lib/ttlCache.js';
import prisma from '../lib/prisma.js';

const AUTH_USER_SELECT = {
  id: true,
  role: true,
  email: true,
  blocked: true,
  tokenVersion: true,
};

const authUserCache = createTtlCache(5_000);

const TOTP_SETUP_ALLOW = new Set([
  '/api/users/me',
  '/api/users/me/security',
  '/api/users/me/2fa/setup',
  '/api/users/me/2fa/setup/cancel',
  '/api/users/me/2fa/confirm',
  '/api/auth/logout',
]);

function getAccessTokenString(req) {
  const c = readCookieValue(req, 'access');
  if (c && typeof c === 'string') return c;
  if (getEnv().NODE_ENV === 'test') {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
  }
  return null;
}

function readTokenVersion(payload) {
  return typeof payload.tv === 'number' && Number.isInteger(payload.tv) ? payload.tv : 0;
}

function toAuthUser(user, totpSetupPending = false) {
  return { id: user.id, role: user.role, email: user.email, totpSetupPending };
}

async function userFromToken(req) {
  const token = getAccessTokenString(req);
  if (!token) return null;
  const payload = verifyAppJwt(token);
  const sub = payload.sub;
  if (typeof sub !== 'string') return null;
  const tokenVersion = readTokenVersion(payload);
  const totpSetupPending = payload.stp === 1;

  const cached = authUserCache.get(sub);
  if (cached) {
    if (cached.blocked) return null;
    if ((cached.tokenVersion ?? 0) !== tokenVersion) return null;
    return toAuthUser(cached, totpSetupPending);
  }

  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: AUTH_USER_SELECT,
  });
  if (!user) return null;
  authUserCache.set(sub, user);
  if (user.blocked) return null;
  if ((user.tokenVersion ?? 0) !== tokenVersion) return null;
  return toAuthUser(user, totpSetupPending);
}

export function invalidateAuthUserCache(userId) {
  if (userId) authUserCache.del(userId);
}

function pathAllowedDuringTotpSetup(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return TOTP_SETUP_ALLOW.has(path);
}

export async function authJwt(req, res, next) {
  try {
    const user = await userFromToken(req);
    if (!user) {
      return res.status(401).json({ error: apiMessages.common.unauthorized, code: 'UNAUTHORIZED' });
    }
    if (user.totpSetupPending && !pathAllowedDuringTotpSetup(req)) {
      return res.status(403).json({
        error: 'Включите двухфакторную защиту, чтобы продолжить',
        code: 'TOTP_SETUP_REQUIRED',
      });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: apiMessages.common.unauthorized, code: 'UNAUTHORIZED' });
  }
}

export async function optionalAuthJwt(req, res, next) {
  try {
    req.user = await userFromToken(req);
  } catch {
    req.user = null;
  }
  next();
}
