import crypto from 'crypto';
import { hmacHex, timingSafeEqualHex, timingSafeEqualString } from './cryptoHash.js';

export function createGuestToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashGuestToken(token) {
  return hmacHex('guest', String(token || ''));
}

export function guestTokenMatches(stored, provided) {
  const expected = String(stored || '');
  const got = String(provided || '').trim();
  if (!expected || !got) return false;
  const hashed = hashGuestToken(got);
  if (expected.length === hashed.length && timingSafeEqualHex(expected, hashed)) return true;
  if (expected.length === got.length && timingSafeEqualString(expected, got)) return true;
  return false;
}
