import { getEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { telemetryInc, telemetryObserveLlmLatency } from './diagnosticsTelemetry.service.js';

function resolveBaseUrl(raw) {
  return String(raw || '').replace(/\/$/, '');
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function looksLikeHtmlError(text) {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('<html') ||
    t.includes('<body') ||
    t.includes('<title>') ||
    t.includes('gateway time-out') ||
    t.includes('openresty') ||
    t.includes('nginx')
  );
}

/**
 * OpenAI-compatible chat completion.
 *
 * @param {{
 *   messages: Array<{role: string, content: string}>,
 *   model?: string,
 *   temperature?: number,
 *   format?: Record<string, unknown>,
 *   timeoutMs?: number,
 *   maxTokens?: number,
 *   options?: Record<string, unknown>,
 * }} params
 * @returns {Promise<string>}
 */
export async function chatCompletion({
  messages,
  model,
  temperature = 0,
  format,
  timeoutMs = 120_000,
  maxTokens,
  options = {},
}) {
  const env = getEnv();
  if (!env.LLM_ENABLED) {
    throw new AppError(503, 'LLM disabled via configuration', 'LLM_ERROR');
  }

  const apiKey = String(env.LLM_API_KEY || '').trim();
  if (!apiKey) {
    throw new AppError(503, 'LLM API key is not configured', 'LLM_ERROR');
  }

  const base = resolveBaseUrl(env.LLM_CLOUD_BASE_URL);
  const targetModel = model || env.LLM_MODEL;

  const body = {
    model: targetModel,
    messages,
    temperature,
    stream: false,
  };
  if (Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0) {
    body.max_tokens = Math.round(Number(maxTokens));
  }
  if (options && typeof options === 'object') {
    Object.assign(body, options);
  }

  if (format) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'consultation_schema',
        strict: true,
        schema: format,
      },
    };
  }

  let res;
  const startedAt = Date.now();
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    telemetryObserveLlmLatency(Date.now() - startedAt);
    telemetryInc('llmErrors');
    const msg = err?.name === 'TimeoutError' ? 'request timed out' : `unreachable: ${err?.message || err}`;
    throw new AppError(503, `LLM unavailable (${msg})`, 'LLM_ERROR');
  }

  if (!res.ok) {
    telemetryObserveLlmLatency(Date.now() - startedAt);
    telemetryInc('llmErrors');
    await res.text().catch(() => '');
    throw new AppError(503, `LLM unavailable (http ${res.status})`, 'LLM_ERROR');
  }

  const data = await res.json();
  telemetryObserveLlmLatency(Date.now() - startedAt);
  const content = normalizeContent(data?.choices?.[0]?.message?.content);
  if (!content || looksLikeHtmlError(content)) {
    telemetryInc('llmErrors');
    throw new AppError(503, 'LLM unavailable (empty content)', 'LLM_ERROR');
  }
  return String(content);
}
