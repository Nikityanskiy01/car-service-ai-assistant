import crypto from 'crypto';
import { getEnv } from '../config/env.js';

export const COOKIE_ACCESS = 'car_service_at';
export const COOKIE_REFRESH = 'car_service_rt';
export const COOKIE_CSRF = 'car_service_csrf';
export const COOKIE_ACCESS_HOST = '__Host-car_service_at';
export const COOKIE_REFRESH_HOST = '__Host-car_service_rt';
export const COOKIE_CSRF_HOST = '__Host-car_service_csrf';

export function usesHostCookies(env = getEnv()) {
  return env.NODE_ENV === 'production';
}

export function getCookieNames(env = getEnv()) {
  if (usesHostCookies(env)) {
    return { access: COOKIE_ACCESS_HOST, refresh: COOKIE_REFRESH_HOST, csrf: COOKIE_CSRF_HOST };
  }
  return { access: COOKIE_ACCESS, refresh: COOKIE_REFRESH, csrf: COOKIE_CSRF };
}

export function readCookieValue(req, kind) {
  const names = getCookieNames();
  const legacy = { access: COOKIE_ACCESS, refresh: COOKIE_REFRESH, csrf: COOKIE_CSRF };
  return req?.cookies?.[names[kind]] || req?.cookies?.[legacy[kind]] || null;
}

function parseJwtExpiresToMs(exp) {
  const m = String(exp).match(/^(\d+)([smhd])$/i);
  if (!m) return 30 * 60 * 1000;
  const n = Number(m[1]);
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[m[2].toLowerCase()] || 60_000);
}

function baseCookieOptions(env) {
  const host = usesHostCookies(env);
  return {
    httpOnly: true,
    secure: host,
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
  const names = getCookieNames(env);
  const base = baseCookieOptions(env);
  const accessMaxMs = parseJwtExpiresToMs(env.JWT_EXPIRES_IN);
  const refreshMaxMs = env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

  res.cookie(names.access, accessToken, { ...base, maxAge: accessMaxMs });
  res.cookie(names.refresh, refreshToken, { ...base, maxAge: refreshMaxMs });

  const csrf = crypto.randomBytes(32).toString('hex');
  res.cookie(names.csrf, csrf, {
    httpOnly: false,
    secure: base.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMaxMs,
  });
}

/** @param {import('express').Response} res */
export function clearAuthCookies(res) {
  const env = getEnv();
  const p = '/';
  const secure = usesHostCookies(env);
  const toClear = [
    COOKIE_ACCESS,
    COOKIE_REFRESH,
    COOKIE_CSRF,
    COOKIE_ACCESS_HOST,
    COOKIE_REFRESH_HOST,
    COOKIE_CSRF_HOST,
  ];
  for (const name of toClear) {
    res.clearCookie(name, {
      path: p,
      sameSite: 'lax',
      secure,
      httpOnly: name !== COOKIE_CSRF && name !== COOKIE_CSRF_HOST,
    });
  }
}
