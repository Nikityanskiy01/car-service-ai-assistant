import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';

/** Строгий лимит для публичных write-эндпоинтов (формы, гости, webhooks). */
export function createPublicWriteLimiter(max = 30) {
  const env = getEnv();
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'test' ? 10_000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
  });
}
