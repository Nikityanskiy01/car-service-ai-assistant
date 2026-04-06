import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/** Render задаёт публичный URL сервиса — используем как CORS, если CORS_ORIGIN не задан. */
function envWithRenderCors() {
  const e = { ...process.env };
  if (
    e.NODE_ENV === 'production' &&
    !String(e.CORS_ORIGIN || '').trim() &&
    String(e.RENDER_EXTERNAL_URL || '').trim()
  ) {
    e.CORS_ORIGIN = e.RENDER_EXTERNAL_URL.trim();
  }
  return e;
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('30m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().optional().refine(
    (v) =>
      process.env.NODE_ENV !== 'production' || (typeof v === 'string' && v.trim().length > 0),
    { message: 'CORS_ORIGIN is required in production (or set RENDER_EXTERNAL_URL on Render)' },
  ),
  LLM_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  LLM_MODEL: z.string().default('qwen2.5:7b'),
  LLM_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_MANAGER_CHAT_IDS: z.string().optional(),
});

let cached;

export function getEnv() {
  if (process.env.NODE_ENV !== 'test' && cached) return cached;
  const parsed = schema.parse(envWithRenderCors());
  if (process.env.NODE_ENV !== 'test') cached = parsed;
  return parsed;
}
