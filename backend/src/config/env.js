import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  SERVE_FRONTEND: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('30m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().optional().refine(
    (v) =>
      process.env.NODE_ENV !== 'production' || (typeof v === 'string' && v.trim().length > 0),
    { message: 'CORS_ORIGIN is required in production' },
  ),
  LLM_PROVIDER: z.enum(['ollama', 'openai']).default('ollama'),
  LLM_FALLBACK_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  LLM_FALLBACK_PROVIDER: z.enum(['ollama', 'openai']).optional(),
  LLM_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  LLM_CLOUD_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('qwen2.5:7b'),
  /** Быстрая модель только для JSON-извлечения полей (пусто = LLM_MODEL). */
  LLM_EXTRACTION_MODEL: z.string().optional(),
  LLM_EXTRACTION_NUM_PREDICT: z.coerce.number().default(280),
  /** Отдельная модель для финального диагноза (пусто = LLM_MODEL). */
  LLM_DIAGNOSIS_MODEL: z.string().optional(),
  LLM_DIAGNOSIS_NUM_PREDICT: z.coerce.number().default(420),
  LLM_DIAGNOSIS_TIMEOUT_MS: z.coerce.number().default(240000),
  LLM_KEEP_ALIVE: z.string().default('30m'),
  LLM_FORCE_EXTRACTION: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  LLM_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_MANAGER_CHAT_IDS: z.string().optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional(),
  DEMO_MODE: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  DEMO_CLIENT_EMAIL: z.string().email().optional().default('client@example.local'),
  DEMO_CLIENT_PASSWORD: z.string().optional().default('1q2w3e4r'),
  DEMO_MANAGER_EMAIL: z.string().email().optional().default('manager@example.local'),
  DEMO_MANAGER_PASSWORD: z.string().optional().default('1q2w3e4r5t'),
  DEMO_ADMIN_EMAIL: z.string().email().optional().default('admin@example.local'),
  DEMO_ADMIN_PASSWORD: z.string().optional().default('1q2w3e4r5t6y'),
});

let cached;

export function getEnv() {
  if (process.env.NODE_ENV !== 'test' && cached) return cached;
  const parsed = schema.parse(process.env);
  if (parsed.LLM_PROVIDER === 'openai' && !String(parsed.LLM_API_KEY || '').trim()) {
    throw new Error('LLM_API_KEY is required when LLM_PROVIDER=openai');
  }
  if (process.env.NODE_ENV !== 'test') cached = parsed;
  return parsed;
}
