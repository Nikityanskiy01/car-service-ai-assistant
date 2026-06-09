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
  LLM_PROVIDER: z.enum(['openai']).default('openai'),
  LLM_FALLBACK_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  LLM_CLOUD_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('qwen/qwen3-coder-next'),
  /** Быстрая модель только для JSON-извлечения полей (пусто = LLM_MODEL). */
  LLM_EXTRACTION_MODEL: z.string().optional(),
  LLM_EXTRACTION_NUM_PREDICT: z.coerce.number().default(280),
  /** Отдельная модель для финального диагноза (пусто = LLM_MODEL). */
  LLM_DIAGNOSIS_MODEL: z.string().optional(),
  LLM_DIAGNOSIS_NUM_PREDICT: z.coerce.number().default(420),
  LLM_DIAGNOSIS_TIMEOUT_MS: z.coerce.number().default(240000),
  CONSULTATION_FLOW_MODE: z.enum(['hybrid', 'llm_first']).default('hybrid'),
  DIAGNOSIS_MODE: z.enum(['hybrid', 'llm_only']).default('hybrid'),
  DIAGNOSIS_TURN_BUDGET_MS: z.coerce.number().int().min(5000).default(20000),
  DIAGNOSIS_MIN_REMAINING_MS: z.coerce.number().int().min(1000).default(6000),
  DIAGNOSIS_FAST_PATH_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  DIAGNOSIS_COMPLEXITY_THRESHOLD: z.coerce.number().int().min(1).max(10).default(4),
  DIAGNOSIS_AGENT_MODE: z.enum(['classic', 'llmfactory']).default('llmfactory'),
  DIAGNOSIS_AGENT_PROFILE: z.enum(['full', 'compact']).default('compact'),
  DIAGNOSIS_AGENT_USE_HINTS: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  DIAGNOSIS_AGENT_TIMEOUT_MS: z.coerce.number().int().min(5000).default(90000),
  DIAGNOSIS_AGENT_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  SSE_HEARTBEAT_MS: z.coerce.number().int().min(5000).default(25000),
  LLM_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
});

let cached;

export function getEnv() {
  if (process.env.NODE_ENV !== 'test' && cached) return cached;
  const parsed = schema.parse(process.env);
  if (!String(parsed.LLM_API_KEY || '').trim()) {
    throw new Error('LLM_API_KEY is required');
  }
  if (process.env.NODE_ENV !== 'test') cached = parsed;
  return parsed;
}
