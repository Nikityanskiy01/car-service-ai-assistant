import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { apiMessages } from '../config/apiMessages.js';
import { readCookieValue } from '../lib/authCookies.js';
import { sendProblem } from '../lib/problem.js';

/** Pre-auth POSTs: same as login — a leftover session cookie must not block them. */
export const CSRF_EXEMPT_POST_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/login/2fa',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/otp/start',
  '/api/auth/otp/verify',
]);

function csrfTokensMatch(cookie: unknown, header: unknown) {
  const a = String(cookie || '');
  const b = String(header || '');
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function requestPath(req: Pick<Request, 'baseUrl' | 'path' | 'originalUrl'>) {
  const fromParts = `${req.baseUrl || ''}${req.path || ''}`.split('?')[0];
  if (fromParts) return fromParts;
  return String(req.originalUrl || '').split('?')[0];
}

function withApiPrefix(path: string) {
  const value = String(path || '');
  if (!value) return value;
  if (value === '/api' || value.startsWith('/api/')) return value;
  return value.startsWith('/') ? `/api${value}` : `/api/${value}`;
}

function isCsrfExemptPost(req: Request) {
  const candidates = [requestPath(req), String(req.originalUrl || '').split('?')[0]];
  return candidates.some((path) => CSRF_EXEMPT_POST_PATHS.has(path) || CSRF_EXEMPT_POST_PATHS.has(withApiPrefix(path)));
}

/**
 * Double-submit CSRF: при наличии auth-cookie требуется заголовок X-CSRF-Token,
 * совпадающий с cookie car_service_csrf. Без auth-cookie (гость) — проверка не требуется.
 * В test окружении отключено.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test') return next();

  const method = req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const fullPath = requestPath(req);

  if (method === 'POST' && isCsrfExemptPost(req)) return next();

  if (fullPath.startsWith('/api/webhooks/')) return next();

  const hasAuthCookie = !!(readCookieValue(req, 'access') || readCookieValue(req, 'refresh'));
  if (!hasAuthCookie) return next();

  const cookie = readCookieValue(req, 'csrf');
  const header = req.headers['x-csrf-token'];
  if (!csrfTokensMatch(cookie, header)) {
    return sendProblem(res, { status: 403, detail: apiMessages.common.csrf, code: 'CSRF' });
  }
  next();
}
