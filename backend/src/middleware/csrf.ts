import crypto from 'crypto';
import { apiMessages } from '../config/apiMessages.js';
import { readCookieValue } from '../lib/authCookies.js';

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

function csrfTokensMatch(cookie, header) {
  const a = String(cookie || '');
  const b = String(header || '');
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function requestPath(req) {
  const fromParts = `${req.baseUrl || ''}${req.path || ''}`;
  if (fromParts) return fromParts.split('?')[0];
  return String(req.originalUrl || '').split('?')[0];
}

/**
 * Double-submit CSRF: при наличии auth-cookie требуется заголовок X-CSRF-Token,
 * совпадающий с cookie car_service_csrf. Без auth-cookie (гость) — проверка не требуется.
 * В test окружении отключено.
 */
export function csrfProtection(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();

  const method = req.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const fullPath = requestPath(req);

  if (method === 'POST' && CSRF_EXEMPT_POST_PATHS.has(fullPath)) return next();

  if (fullPath.startsWith('/api/webhooks/')) return next();

  const hasAuthCookie = !!(readCookieValue(req, 'access') || readCookieValue(req, 'refresh'));
  if (!hasAuthCookie) return next();

  const cookie = readCookieValue(req, 'csrf');
  const header = req.headers['x-csrf-token'];
  if (!csrfTokensMatch(cookie, header)) {
    return res.status(403).json({ error: apiMessages.common.csrf, code: 'CSRF' });
  }
  next();
}
