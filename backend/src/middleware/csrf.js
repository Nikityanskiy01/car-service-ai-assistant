import { COOKIE_ACCESS, COOKIE_CSRF, COOKIE_REFRESH } from '../lib/authCookies.js';

/**
 * Double-submit CSRF: при наличии auth-cookie требуется заголовок X-CSRF-Token,
 * совпадающий с cookie fm_csrf. Без auth-cookie (гость) — проверка не требуется.
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

  const hasAuthCookie = !!(req.cookies?.[COOKIE_ACCESS] || req.cookies?.[COOKIE_REFRESH]);
  if (!hasAuthCookie) return next();

  const cookie = req.cookies?.[COOKIE_CSRF];
  const header = req.headers['x-csrf-token'];
  if (!cookie || !header || cookie !== String(header)) {
    return res.status(403).json({ error: 'CSRF token missing or invalid', code: 'CSRF' });
  }
  next();
}
