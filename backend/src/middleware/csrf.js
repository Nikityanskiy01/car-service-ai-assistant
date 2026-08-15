import crypto from 'crypto';
import { apiMessages } from '../config/apiMessages.js';
import { readCookieValue } from '../lib/authCookies.js';

function csrfTokensMatch(cookie, header) {
  const a = String(cookie || '');
  const b = String(header || '');
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
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

  const fullPath = `${req.baseUrl || ''}${req.path || ''}`;

  if (method === 'POST' && fullPath === '/api/auth/login') return next();
  if (method === 'POST' && fullPath === '/api/auth/register') return next();
  if (method === 'POST' && fullPath === '/api/auth/refresh') return next();
  if (method === 'POST' && fullPath === '/api/auth/forgot-password') return next();
  if (method === 'POST' && fullPath === '/api/auth/reset-password') return next();
  if (method === 'POST' && fullPath === '/api/auth/verify-email') return next();
  if (method === 'POST' && fullPath === '/api/auth/resend-verification') return next();

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
