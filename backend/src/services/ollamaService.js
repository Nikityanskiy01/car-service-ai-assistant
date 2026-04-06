import { getEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';

/**
 * Normalizes LLM_BASE_URL: strips trailing `/v1` or `/` for the native Ollama API.
 */
function resolveBaseUrl(raw) {
  return raw.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

/**
 * Ollama native `/api/chat` with optional structured output (`format` JSON Schema).
 *
 * @param {{
 *   messages: Array<{role: string, content: string}>,
 *   model?: string,
 *   temperature?: number,
 *   format?: Record<string, unknown>
 * }} params
 * @returns {Promise<string>} assistant message content
 */
export async function chatCompletion({ messages, model, temperature = 0, format }) {
  const env = getEnv();

  if (!env.LLM_ENABLED) {
    throw new AppError(503, 'LLM disabled via configuration', 'LLM_ERROR');
  }

  const base = resolveBaseUrl(env.LLM_BASE_URL);
  const url = `${base}/api/chat`;

  const body = {
    model: model || env.LLM_MODEL,
    messages,
    temperature,
    stream: false,
  };
  if (format) body.format = format;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? 'LLM request timed out' : `LLM unreachable: ${err.message}`;
    throw new AppError(503, msg, 'LLM_ERROR');
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new AppError(503, `LLM unavailable: ${res.status} ${t.slice(0, 200)}`, 'LLM_ERROR');
  }

  const data = await res.json();
  const content = data?.message?.content;
  if (!content) throw new AppError(503, 'LLM returned empty content', 'LLM_ERROR');
  return String(content);
}
