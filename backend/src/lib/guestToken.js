import { hmacHex, hmacHexMatches } from './cryptoHash.js';
import crypto from 'crypto';

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
  return hmacHexMatches('guest', got, expected);
}
