const TOTP_SETUP_ALLOW = new Set([
  '/api/users/me',
  '/api/users/me/security',
  '/api/users/me/2fa/setup',
  '/api/users/me/2fa/setup/cancel',
  '/api/users/me/2fa/confirm',
  '/api/auth/logout',
  '/api/auth/refresh',
]);

/** `/api/users/me/` and `/users/me` must match the allow-list, not trip TOTP 403. */
export function normalizeApiPath(raw: string) {
  const trimmed = String(raw || '')
    .split('?')[0]
    .replace(/\/+$/, '');
  const path = trimmed || '/';
  if (path === '/api' || path.startsWith('/api/')) return path;
  return path.startsWith('/') ? `/api${path}` : `/api/${path}`;
}

export function isPathAllowedDuringTotpSetup(rawPath: string) {
  return TOTP_SETUP_ALLOW.has(normalizeApiPath(rawPath));
}
