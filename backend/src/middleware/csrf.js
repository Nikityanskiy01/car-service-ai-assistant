import crypto from 'crypto';
import { COOKIE_ACCESS, COOKIE_CSRF, COOKIE_REFRESH } from '../lib/authCookies.js';

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

  const hasAuthCookie = !!(req.cookies?.[COOKIE_ACCESS] || req.cookies?.[COOKIE_REFRESH]);
  if (!hasAuthCookie) return next();

  const cookie = req.cookies?.[COOKIE_CSRF];
  const header = req.headers['x-csrf-token'];
  if (!csrfTokensMatch(cookie, header)) {
    return res.status(403).json({ error: 'CSRF token missing or invalid', code: 'CSRF' });
  }
  next();
}
