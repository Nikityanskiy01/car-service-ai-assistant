import crypto from 'crypto';
import { getEnv } from '../config/env.js';

function peppers() {
  const env = getEnv();
  const keys = [];
  const dedicated = String(env.HMAC_PEPPER || '').trim();
  if (dedicated.length >= 32) keys.push(dedicated);
  const jwt = String(env.JWT_SECRET || '');
  if (jwt && !keys.includes(jwt)) keys.push(jwt);
  return keys.length ? keys : [''];
}

export function hmacHex(purpose, value) {
  return crypto.createHmac('sha256', peppers()[0]).update(`${purpose}:${value}`).digest('hex');
}

export function hmacHexMatches(purpose, value, stored) {
  const expected = String(stored || '');
  if (!expected) return false;
  for (const key of peppers()) {
    const got = crypto.createHmac('sha256', key).update(`${purpose}:${value}`).digest('hex');
    if (timingSafeEqualHex(expected, got)) return true;
  }
  return false;
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function timingSafeEqualHex(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const aBuf = Buffer.from(left);
  const bBuf = Buffer.from(right);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
