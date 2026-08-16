import type { NextFunction, Request, Response } from 'express';
import { apiMessages } from '../config/apiMessages.js';
import { getEnv } from '../config/env.js';
import { readCookieValue } from '../lib/authCookies.js';
import { verifyAppJwt } from '../lib/jwtTokens.js';
import { createTtlCache } from '../lib/ttlCache.js';
import prisma from '../lib/prisma.js';
import { isPathAllowedDuringTotpSetup } from '../lib/totpSetupPaths.js';
import { sendProblem } from '../lib/problem.js';
import type { AuthUser } from '../types/auth.js';

const AUTH_USER_SELECT = {
  id: true,
  role: true,
  email: true,
  blocked: true,
  tokenVersion: true,
};

type CachedAuthUser = {
  id: string;
  role: string;
  email: string;
  blocked: boolean;
  tokenVersion: number | null;
};

const authUserCache = createTtlCache<CachedAuthUser>(5_000);

function getAccessTokenString(req: Request) {
  const c = readCookieValue(req, 'access');
  if (c && typeof c === 'string') return c;
  if (getEnv().NODE_ENV === 'test') {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
  }
  return null;
}

function readTokenVersion(payload: { tv?: unknown }) {
  return typeof payload.tv === 'number' && Number.isInteger(payload.tv) ? payload.tv : 0;
}

function readSessionId(payload: { sid?: unknown }) {
  return typeof payload.sid === 'string' && payload.sid ? payload.sid : undefined;
}

function toAuthUser(user: CachedAuthUser, totpSetupPending = false, sessionId?: string): AuthUser {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    totpSetupPending: totpSetupPending && getEnv().STAFF_2FA_REQUIRED,
    sessionId,
  };
}

async function userFromToken(req: Request) {
  const token = getAccessTokenString(req);
  if (!token) return null;
  const payload = verifyAppJwt(token);
  const sub = payload.sub;
  if (typeof sub !== 'string') return null;
  const tokenVersion = readTokenVersion(payload);
  const totpSetupPending = payload.stp === 1;
  const sessionId = readSessionId(payload);

  const cached = authUserCache.get(sub);
  if (cached) {
    if (cached.blocked) return null;
    if ((cached.tokenVersion ?? 0) !== tokenVersion) return null;
    return toAuthUser(cached, totpSetupPending, sessionId);
  }

  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: AUTH_USER_SELECT,
  });
  if (!user) return null;
  authUserCache.set(sub, user);
  if (user.blocked) return null;
  if ((user.tokenVersion ?? 0) !== tokenVersion) return null;
  return toAuthUser(user, totpSetupPending, sessionId);
}

export function invalidateAuthUserCache(userId?: string | null) {
  if (userId) authUserCache.del(userId);
}

function pathAllowedDuringTotpSetup(req: Request) {
  return isPathAllowedDuringTotpSetup(String(req.originalUrl || req.url || `${req.baseUrl || ''}${req.path || ''}`));
}

export async function authJwt(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userFromToken(req);
    if (!user) {
      return sendProblem(res, { status: 401, detail: apiMessages.common.unauthorized, code: 'UNAUTHORIZED' });
    }
    if (user.totpSetupPending && !pathAllowedDuringTotpSetup(req)) {
      return sendProblem(res, {
        status: 403,
        detail: 'Включите двухфакторную защиту, чтобы продолжить',
        code: 'TOTP_SETUP_REQUIRED',
      });
    }
    req.user = user;
    next();
  } catch {
    return sendProblem(res, { status: 401, detail: apiMessages.common.unauthorized, code: 'UNAUTHORIZED' });
  }
}

export async function optionalAuthJwt(req: Request, res: Response, next: NextFunction) {
  try {
    req.user = await userFromToken(req);
  } catch {
    req.user = null;
  }
  next();
}
