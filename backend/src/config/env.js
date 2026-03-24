import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().optional(),
  LLM_BASE_URL: z.string().default('http://127.0.0.1:11434/v1'),
  LLM_MODEL: z.string().default('llama3.2'),
  LLM_MOCK: z.boolean().default(false),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_MANAGER_CHAT_IDS: z.string().optional(),
});

let cached;

export function getEnv() {
  if (process.env.NODE_ENV !== 'test' && cached) return cached;
  const raw = process.env;
  const llmMock =
    raw.LLM_MOCK === '1' ||
    raw.LLM_MOCK === 'true' ||
    raw.NODE_ENV === 'test';
  const parsed = schema.parse({
    ...raw,
    LLM_MOCK: llmMock,
  });
  if (process.env.NODE_ENV !== 'test') cached = parsed;
  return parsed;
}
