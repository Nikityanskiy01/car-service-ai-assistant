import rateLimit from 'express-rate-limit';
import { apiMessages } from '../config/apiMessages.js';
import { getEnv } from '../config/env.js';
import { getRedis } from '../lib/redis.js';

/** Пакет опционален: отсутствие в образе не должно валить процесс. */
let RedisStoreCtor = null;
try {
  const mod = await import('rate-limit-redis');
  RedisStoreCtor = mod.RedisStore;
} catch {
  RedisStoreCtor = null;
}

function attachStore(opts) {
  if (process.env.NODE_ENV === 'test') return opts;
  const redis = getRedis();
  if (!redis || !RedisStoreCtor) return opts;
  try {
    opts.store = new RedisStoreCtor({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:',
    });
  } catch {
    // memory fallback
  }
  return opts;
}

export function isOperationalApiPath(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return url === '/api/health' || url === '/api/live' || url === '/api/ready' || url === '/api/metrics';
}

/** Ключ лимита входа: IP + логин, чтобы NAT/Docker gateway не блокировал всех сразу. */
export function authAttemptKey(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'anon');
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const identifier = String(body.identifier || body.email || body.phone || '')
    .trim()
    .toLowerCase()
    .slice(0, 254);
  return identifier ? `${ip}:${identifier}` : ip;
}

export function createRateLimiter({
  windowMs,
  max,
  message,
  keyGenerator,
  skip,
  skipSuccessfulRequests = false,
} = {}) {
  const env = getEnv();
  return rateLimit(
    attachStore({
      windowMs: windowMs || 15 * 60 * 1000,
      max: env.NODE_ENV === 'test' ? 10_000 : max,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      skip,
      message: message || { error: apiMessages.common.rateLimitedRequests, code: 'RATE_LIMITED' },
      keyGenerator,
    }),
  );
}

export function createPublicWriteLimiter(max = 30) {
  return createRateLimiter({
    max,
    message: { error: apiMessages.common.rateLimitedRequests, code: 'RATE_LIMITED' },
  });
}

export function createLlmLimiter() {
  return createRateLimiter({
    max: 8,
    windowMs: 15 * 60 * 1000,
    message: {
      error: 'Слишком много запросов к интеллектуальному анализу. Подождите 15 минут.',
      code: 'LLM_RATE_LIMITED',
    },
  });
}

export function createVisionLimiter() {
  return createRateLimiter({
    max: 2,
    windowMs: 15 * 60 * 1000,
    message: {
      error: 'Слишком много запросов на анализ фото. Подождите 15 минут.',
      code: 'LLM_RATE_LIMITED',
    },
  });
}
