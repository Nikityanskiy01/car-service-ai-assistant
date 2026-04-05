import { getEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';

/**
 * @param {{ messages: Array<{role: string, content: string}>, model?: string, temperature?: number }} params
 */
export async function chatCompletion({ messages, model = 'llama3.2', temperature = 0 }) {
  const env = getEnv();
  const base = env.LLM_BASE_URL || 'http://127.0.0.1:11434/v1';
  const url = `${base.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new AppError(503, `LLM unavailable: ${res.status} ${t.slice(0, 200)}`, 'LLM_ERROR');
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new AppError(503, 'LLM returned empty content', 'LLM_ERROR');
  return String(content);
}
