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
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('30m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().optional().refine(
    (v) =>
      process.env.NODE_ENV !== 'production' || (typeof v === 'string' && v.trim().length > 0),
    { message: 'CORS_ORIGIN is required in production' },
  ),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional().refine(
    (v) =>
      process.env.NODE_ENV !== 'production' ||
      process.env.NODE_ENV === 'test' ||
      (typeof v === 'string' && v.trim().length >= 32),
    { message: 'INTEGRATION_ENCRYPTION_KEY (min 32 chars) is required in production' },
  ),
  TOTP_ENCRYPTION_KEY: z.string().optional(),
  STAFF_2FA_REQUIRED: z
    .enum(['true', 'false', '1', '0'])
    .default(process.env.NODE_ENV === 'production' ? 'true' : 'false')
    .transform((v) => v === 'true' || v === '1'),
  LLM_CLOUD_PII_ALLOWED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  GUEST_SESSION_TTL_HOURS: z.coerce.number().default(24),
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
  /** Модель embeddings (Ollama: nomic-embed-text, OpenAI: text-embedding-3-small). */
  LLM_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  CASE_MEMORY_SEMANTIC_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  CASE_MEMORY_TOP_K: z.coerce.number().default(5),
  CASE_MEMORY_LEXICAL_FALLBACK: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  CONSULTATION_FEEDBACK_FEW_SHOT_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  CONSULTATION_FEEDBACK_FEW_SHOT_LIMIT: z.coerce.number().default(3),
  LLM_CIRCUIT_BREAKER_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  LLM_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().default(5),
  LLM_CIRCUIT_COOLDOWN_MS: z.coerce.number().default(60_000),
  DIAGNOSIS_CACHE_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  DIAGNOSIS_CACHE_TTL_MS: z.coerce.number().default(3_600_000),
  DIAGNOSIS_CACHE_MAX_ENTRIES: z.coerce.number().default(200),
  DIAGNOSIS_QUEUE_CONCURRENCY: z.coerce.number().default(2),
  DIAGNOSIS_ASYNC_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** false — HTTP-процесс не поднимает BullMQ/SLA/outbox (их крутит отдельный worker). */
  RUN_BACKGROUND_JOBS: z
    .enum(['true', 'false', '1', '0'])
    .default('true')
    .transform((v) => v === 'true' || v === '1'),
  /** Опционально: Redis для BullMQ async-диагноза. */
  REDIS_URL: z.string().optional(),
  LLM_VISION_MODEL: z.string().default('llava'),
  LLM_VISION_TIMEOUT_MS: z.coerce.number().default(90000),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_MANAGER_CHAT_IDS: z.string().optional(),
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  OTP_CODE_TTL_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Автоассистент <noreply@localhost>'),
  APP_PUBLIC_URL: z.string().default('http://127.0.0.1:8080'),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().default(60),
  EMAIL_VERIFICATION_CODE_TTL_MINUTES: z.coerce.number().default(15),
  EMAIL_VERIFICATION_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().optional(),
  OTEL_SDK_DISABLED: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
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
