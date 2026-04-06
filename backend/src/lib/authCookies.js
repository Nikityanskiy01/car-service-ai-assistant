import crypto from 'crypto';
import { getEnv } from '../config/env.js';

export const COOKIE_ACCESS = 'fm_at';
export const COOKIE_REFRESH = 'fm_rt';
export const COOKIE_CSRF = 'fm_csrf';

function parseJwtExpiresToMs(exp) {
  const m = String(exp).match(/^(\d+)([smhd])$/i);
  if (!m) return 30 * 60 * 1000;
  const n = Number(m[1]);
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[m[2].toLowerCase()] || 60_000);
}

function baseCookieOptions(env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * @param {import('express').Response} res
 * @param {{ accessToken: string, refreshToken: string, user: object }} tokens
 */
export function setAuthCookies(res, { accessToken, refreshToken }) {
  const env = getEnv();
  const base = baseCookieOptions(env);
  const accessMaxMs = parseJwtExpiresToMs(env.JWT_EXPIRES_IN);
  const refreshMaxMs = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

  res.cookie(COOKIE_ACCESS, accessToken, { ...base, maxAge: accessMaxMs });
  res.cookie(COOKIE_REFRESH, refreshToken, { ...base, maxAge: refreshMaxMs });

  const csrf = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE_CSRF, csrf, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxMs,
  });
}

/** @param {import('express').Response} res */
export function clearAuthCookies(res) {
  const env = getEnv();
  const p = '/';
  res.clearCookie(COOKIE_ACCESS, { path: p, sameSite: 'lax' });
  res.clearCookie(COOKIE_REFRESH, { path: p, sameSite: 'lax' });
  res.clearCookie(COOKIE_CSRF, {
    path: p,
    sameSite: 'lax',
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
  });
}
