import crypto from 'crypto';
import { getEnv } from '../config/env.js';

function pepper() {
  return String(getEnv().JWT_SECRET || '');
}

export function hmacHex(purpose, value) {
  return crypto.createHmac('sha256', pepper()).update(`${purpose}:${value}`).digest('hex');
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
