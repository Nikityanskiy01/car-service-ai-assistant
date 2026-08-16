import type { Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { apiMessages } from '../config/apiMessages.js';
import { getEnv } from '../config/env.js';
import { getRedis } from '../lib/redis.js';
import { sendProblem } from '../lib/problem.js';

let RedisStoreCtor: any = null;
try {
  const mod = await import('rate-limit-redis');
  RedisStoreCtor = mod.RedisStore;
} catch {
  RedisStoreCtor = null;
}

function attachStore(opts: Record<string, unknown>, prefix = 'rl:') {
  if (process.env.NODE_ENV === 'test') return opts;
  const redis = getRedis();
  if (!redis || !RedisStoreCtor) return opts;
  try {
    opts.store = new RedisStoreCtor({
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix,
    });
  } catch {
    // memory fallback
  }
  return opts;
}

export function isOperationalApiPath(req: { originalUrl?: string; url?: string }) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  const path = url.replace(/^\/api\/v1(?=\/|$)/, '/api');
  return path === '/api/health' || path === '/api/live' || path === '/api/ready' || path === '/api/metrics';
}

export function isSafeHttpMethod(req: { method?: string }) {
  const method = String(req.method || '').toUpperCase();
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

export function skipGlobalRateLimit(req: Request) {
  return isOperationalApiPath(req) || isSafeHttpMethod(req);
}

export function authAttemptKey(req: Request) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'anon');
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const identifier = String(body.identifier || body.email || body.phone || '')
    .trim()
    .toLowerCase()
    .slice(0, 254);
  return identifier ? `${ip}:${identifier}` : ip;
}

function problemRateLimitHandler(req: Request, res: Response, _next: unknown, options: { message?: unknown }) {
  const msg = options.message;
  let detail = apiMessages.common.rateLimitedRequests;
  let code = 'RATE_LIMITED';
  if (msg && typeof msg === 'object' && 'error' in msg) {
    const payload = msg as { error?: unknown; code?: unknown };
    if (payload.error) detail = String(payload.error);
    if (payload.code) code = String(payload.code);
  }
  sendProblem(res, {
    status: 429,
    detail,
    code,
    instance: req.id ? `/requests/${req.id}` : req.path,
  });
}

export function createRateLimiter({
  windowMs,
  max,
  message,
  keyGenerator,
  skip,
  skipSuccessfulRequests = false,
  prefix,
}: {
  windowMs?: number;
  max?: number;
  message?: unknown;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  skipSuccessfulRequests?: boolean;
  prefix?: string;
} = {}): RequestHandler {
  const env = getEnv();
  return rateLimit(
    attachStore(
      {
        windowMs: windowMs || 15 * 60 * 1000,
        max: env.NODE_ENV === 'test' ? 10_000 : max,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        skip,
        message: message || { error: apiMessages.common.rateLimitedRequests, code: 'RATE_LIMITED' },
        handler: problemRateLimitHandler,
        keyGenerator,
      },
      prefix || 'rl:',
    ) as any,
  );
}

export function createPublicWriteLimiter(max = 60) {
  return createRateLimiter({
    max,
    windowMs: 60 * 1000,
    prefix: 'rl:write:',
    message: { error: apiMessages.common.rateLimitedRequests, code: 'RATE_LIMITED' },
  });
}

export function createLlmLimiter() {
  return createRateLimiter({
    max: 8,
    windowMs: 15 * 60 * 1000,
    prefix: 'rl:llm:',
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
    prefix: 'rl:vision:',
    message: {
      error: 'Слишком много запросов на анализ фото. Подождите 15 минут.',
      code: 'LLM_RATE_LIMITED',
    },
  });
}
