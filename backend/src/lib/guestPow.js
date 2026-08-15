import crypto from 'crypto';
import { hmacHex, timingSafeEqualHex } from './cryptoHash.js';
import { getRedis } from './redis.js';

const DIFFICULTY = 4;
const POW_TTL_SEC = 15 * 60;
const usedMemory = new Map();

export function createAbuseChallenge() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const sig = hmacHex('pow', `${nonce}:${issuedAt}:${DIFFICULTY}`);
  return { nonce, issuedAt, difficulty: DIFFICULTY, sig };
}

export function abuseChallengeFromRequest(req) {
  const headers = req?.headers || {};
  const query = req?.query || {};
  return {
    nonce: headers['x-abuse-nonce'] || query.abuseNonce,
    issuedAt: headers['x-abuse-issued'] || query.abuseIssued,
    difficulty: headers['x-abuse-difficulty'] || query.abuseDifficulty,
    sig: headers['x-abuse-sig'] || query.abuseSig,
    solution: headers['x-abuse-solution'] || query.abuseSolution,
  };
}

export function toAbuseHttpHeaders(challenge) {
  return {
    'X-Abuse-Nonce': String(challenge.nonce || ''),
    'X-Abuse-Issued': String(challenge.issuedAt ?? ''),
    'X-Abuse-Difficulty': String(challenge.difficulty ?? ''),
    'X-Abuse-Sig': String(challenge.sig || ''),
    'X-Abuse-Solution': String(challenge.solution ?? ''),
  };
}

export function solveAbuseChallenge(challenge, maxAttempts = 4_000_000) {
  const difficulty = Math.max(0, Number(challenge.difficulty) || 0);
  const prefix = '0'.repeat(difficulty);
  const nonce = String(challenge.nonce || '');
  for (let n = 0; n < maxAttempts; n += 1) {
    const proof = String(n);
    const hash = crypto.createHash('sha256').update(`${nonce}:${proof}`).digest('hex');
    if (hash.startsWith(prefix)) {
      return { ...challenge, difficulty, solution: proof };
    }
  }
  throw new Error('Не удалось пройти проверку антибота');
}

export function isValidAbuseSolution({ nonce, issuedAt, difficulty, sig, solution }, now = Date.now()) {
  const n = String(nonce || '');
  const ts = Number(issuedAt);
  const diff = Number(difficulty);
  const proof = String(solution ?? '');
  if (!n || !Number.isFinite(ts) || diff !== DIFFICULTY || !proof) return false;
  if (now - ts > POW_TTL_SEC * 1000 || ts > now + 60_000) return false;
  const expectedSig = hmacHex('pow', `${n}:${ts}:${diff}`);
  if (!timingSafeEqualHex(expectedSig, String(sig || ''))) return false;
  const hash = crypto.createHash('sha256').update(`${n}:${proof}`).digest('hex');
  return hash.startsWith('0'.repeat(diff));
}

async function consumeNonce(nonce) {
  const key = `pow:${nonce}`;
  const redis = getRedis();
  if (redis) {
    const ok = await redis.set(key, '1', 'EX', POW_TTL_SEC, 'NX');
    return ok === 'OK';
  }
  const now = Date.now();
  for (const [item, exp] of usedMemory) {
    if (exp < now) usedMemory.delete(item);
  }
  if (usedMemory.has(nonce)) return false;
  usedMemory.set(nonce, now + POW_TTL_SEC * 1000);
  return true;
}

export async function verifyAbuseChallenge(fields) {
  if (process.env.NODE_ENV === 'test') return true;
  if (!isValidAbuseSolution(fields)) return false;
  return consumeNonce(String(fields.nonce || ''));
}
