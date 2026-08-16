import crypto from 'crypto';
import { getRedis } from '../lib/redis.js';
import { sendProblem } from '../lib/problem.js';

const TTL_SEC = 24 * 60 * 60;
const PENDING_MAX_MS = 60_000;
const memory = new Map();

function fingerprintOf(req) {
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function cacheKey(req, key) {
  const actor = req.user?.id || req.ip || 'anon';
  const path = `${req.method}:${req.baseUrl || ''}${req.path || ''}`;
  return `idem:${path}:${actor}:${key}`;
}

function memoryGet(key) {
  const row = memory.get(key);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

function memorySet(key, value, ttlSec = TTL_SEC) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

async function loadRecord(key) {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

async function saveRecord(key, value, ttlSec = TTL_SEC) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
      return;
    } catch {
      /* memory fallback */
    }
  }
  memorySet(key, value, ttlSec);
}

async function deleteRecord(key) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      /* ignore */
    }
  }
  memory.delete(key);
}

/**
 * Optional Idempotency-Key for public POST. Replay returns the stored JSON body.
 */
export function idempotency() {
  return async function idempotencyMiddleware(req, res, next) {
    const key = String(req.get('Idempotency-Key') || req.get('idempotency-key') || '').trim();
    if (!key) return next();
    if (key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) {
      return sendProblem(res, {
        status: 400,
        detail: 'Некорректный ключ идемпотентности',
        code: 'INVALID_IDEMPOTENCY_KEY',
        instance: req.path,
      });
    }

    const storeKey = cacheKey(req, key);
    const fingerprint = fingerprintOf(req);
    const existing = await loadRecord(storeKey);

    if (existing?.status === 'done') {
      if (existing.fingerprint && existing.fingerprint !== fingerprint) {
        return sendProblem(res, {
          status: 422,
          detail: 'Этот ключ идемпотентности уже использован с другими данными',
          code: 'IDEMPOTENCY_KEY_REUSED',
          instance: req.path,
        });
      }
      res.setHeader('Idempotency-Replayed', 'true');
      return res.status(existing.statusCode || 200).json(existing.body);
    }

    if (existing?.status === 'pending') {
      const age = Date.now() - (existing.startedAt || 0);
      if (age < PENDING_MAX_MS) {
        return sendProblem(res, {
          status: 409,
          detail: 'Запрос с этим ключом идемпотентности уже выполняется',
          code: 'IDEMPOTENCY_IN_PROGRESS',
          instance: req.path,
        });
      }
    }

    await saveRecord(storeKey, { status: 'pending', fingerprint, startedAt: Date.now() }, 120);

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const statusCode = res.statusCode || 200;
      if (statusCode >= 500) {
        void deleteRecord(storeKey);
      } else {
        void saveRecord(storeKey, {
          status: 'done',
          statusCode,
          body,
          fingerprint,
        });
      }
      return originalJson(body);
    };

    next();
  };
}
