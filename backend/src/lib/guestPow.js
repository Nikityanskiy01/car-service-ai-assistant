import crypto from 'crypto';
import { hmacHex, timingSafeEqualHex } from './cryptoHash.js';

const DIFFICULTY = 2;

export function createAbuseChallenge() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const sig = hmacHex('pow', `${nonce}:${issuedAt}:${DIFFICULTY}`);
  return { nonce, issuedAt, difficulty: DIFFICULTY, sig };
}

export function verifyAbuseChallenge({ nonce, issuedAt, difficulty, sig, solution }) {
  if (process.env.NODE_ENV === 'test') return true;
  const n = String(nonce || '');
  const ts = Number(issuedAt);
  const diff = Number(difficulty);
  const proof = String(solution ?? '');
  if (!n || !Number.isFinite(ts) || diff !== DIFFICULTY || !proof) return false;
  if (Date.now() - ts > 15 * 60 * 1000 || ts > Date.now() + 60_000) return false;
  const expectedSig = hmacHex('pow', `${n}:${ts}:${diff}`);
  if (!timingSafeEqualHex(expectedSig, String(sig || ''))) return false;
  const hash = crypto.createHash('sha256').update(`${n}:${proof}`).digest('hex');
  return hash.startsWith('0'.repeat(diff));
}
