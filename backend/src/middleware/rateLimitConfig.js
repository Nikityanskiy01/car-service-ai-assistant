import rateLimit from 'express-rate-limit';
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

export function createRateLimiter({ windowMs, max, message, keyGenerator } = {}) {
  const env = getEnv();
  return rateLimit(
    attachStore({
      windowMs: windowMs || 15 * 60 * 1000,
      max: env.NODE_ENV === 'test' ? 10_000 : max,
      standardHeaders: true,
      legacyHeaders: false,
      message: message || { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
      keyGenerator,
    }),
  );
}

export function createPublicWriteLimiter(max = 30) {
  return createRateLimiter({
    max,
    message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
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
