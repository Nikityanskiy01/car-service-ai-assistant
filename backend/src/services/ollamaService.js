import { getEnv } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const LLM_PROVIDERS = ['ollama', 'openai'];

/**
 * For Ollama native API we normalize base URL and strip trailing `/v1`/`/`.
 */
function resolveOllamaBaseUrl(raw) {
  return raw.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

/**
 * For OpenAI-compatible APIs use plain `/v1`.
 */
function resolveOpenAiBaseUrl(raw) {
  return raw.replace(/\/$/, '');
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function normalizeOpenAiContent(content) {
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

/**
 * @param {'ollama'|'openai'} provider
 * @param {ReturnType<typeof getEnv>} env
 */
function canUseProvider(provider, env) {
  if (provider === 'openai') {
    return String(env.LLM_API_KEY || '').trim().length > 0;
  }
  return true;
}

/**
 * @param {'ollama'|'openai'} primary
 * @param {ReturnType<typeof getEnv>} env
 * @returns {'ollama'|'openai'|null}
 */
function resolveFallbackProvider(primary, env) {
  if (!env.LLM_FALLBACK_ENABLED) return null;
  const configured = env.LLM_FALLBACK_PROVIDER;
  if (configured && configured !== primary) return configured;
  return LLM_PROVIDERS.find((p) => p !== primary) || null;
}

/**
 * @param {'ollama'|'openai'} provider
 * @param {{
 *   env: ReturnType<typeof getEnv>,
 *   targetModel: string,
 *   messages: Array<{role: string, content: string}>,
 *   temperature: number,
 *   format?: Record<string, unknown>,
 *   options?: Record<string, unknown>,
 *   keepAlive?: string,
 * }} params
 */
function buildProviderRequest(provider, { env, targetModel, messages, temperature, format, options, keepAlive }) {
  /** @type {Record<string, string>} */
  let headers = { 'Content-Type': 'application/json' };
  let url = '';
  let body = {};

  if (provider === 'openai') {
    const base = resolveOpenAiBaseUrl(env.LLM_CLOUD_BASE_URL);
    url = `${base}/chat/completions`;
    headers = {
      ...headers,
      Authorization: `Bearer ${String(env.LLM_API_KEY || '').trim()}`,
    };
    body = {
      model: targetModel,
      messages,
      temperature,
      stream: false,
    };
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
  } else {
    const base = resolveOllamaBaseUrl(env.LLM_BASE_URL);
    url = `${base}/api/chat`;
    body = {
      model: targetModel,
      messages,
      temperature,
      stream: false,
    };
    if (format) body.format = format;
    if (options && Object.keys(options).length) body.options = options;
    body.keep_alive = keepAlive || env.LLM_KEEP_ALIVE;
  }

  return { url, headers, body };
}

/**
 * @param {'ollama'|'openai'} provider
 * @param {{
 *   env: ReturnType<typeof getEnv>,
 *   targetModel: string,
 *   messages: Array<{role: string, content: string}>,
 *   temperature: number,
 *   format?: Record<string, unknown>,
 *   options?: Record<string, unknown>,
 *   timeoutMs: number,
 *   keepAlive?: string,
 * }} params
 */
async function requestProviderCompletion(
  provider,
  { env, targetModel, messages, temperature, format, options, timeoutMs, keepAlive },
) {
  const { url, headers, body } = buildProviderRequest(provider, {
    env,
    targetModel,
    messages,
    temperature,
    format,
    options,
    keepAlive,
  });

  const runRequest = async (requestBody) => {
    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  let res;
  try {
    res = await runRequest(body);
  } catch (err) {
    const isTimeout =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      /aborted|timeout/i.test(String(err?.message || ''));
    const msg = isTimeout ? 'request timed out' : `unreachable: ${err.message}`;
    throw new Error(msg);
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const canRetryWithoutSchema =
      provider === 'openai' &&
      Boolean(body?.response_format) &&
      res.status === 400 &&
      /response[_\s-]?format|json[_\s-]?schema|model id|litellm\.badrequesterror/i.test(t);
    if (canRetryWithoutSchema) {
      const retryBody = { ...body };
      delete retryBody.response_format;
      const retryRes = await runRequest(retryBody);
      if (!retryRes.ok) {
        const retryText = await retryRes.text().catch(() => '');
        throw new Error(`http ${retryRes.status} ${retryText.slice(0, 200)}`);
      }
      const retryData = await retryRes.json();
      const retryContent = normalizeOpenAiContent(retryData?.choices?.[0]?.message?.content);
      if (!retryContent) throw new Error('empty content');
      return {
        content: String(retryContent),
        provider,
        model: targetModel,
        streamed: false,
      };
    }
    throw new Error(`http ${res.status} ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  const content =
    provider === 'openai'
      ? normalizeOpenAiContent(data?.choices?.[0]?.message?.content)
      : data?.message?.content;
  if (!content) throw new Error('empty content');
  return {
    content: String(content),
    provider,
    model: targetModel,
    streamed: false,
  };
}

/**
 * Unified chat completion:
 * - Ollama native `/api/chat`
 * - OpenAI-compatible `/chat/completions`
 *
 * @param {{
 *   messages: Array<{role: string, content: string}>,
 *   model?: string,
 *   temperature?: number,
 *   format?: Record<string, unknown>,
 *   options?: Record<string, unknown>,
 *   timeoutMs?: number,
 *   keepAlive?: string,
 * }} params
 * @returns {Promise<string>} assistant message content
 */
export async function chatCompletion({
  messages,
  model,
  temperature = 0,
  format,
  options,
  timeoutMs = 120_000,
  keepAlive,
}) {
  const detailed = await chatCompletionWithMeta({
    messages,
    model,
    temperature,
    format,
    options,
    timeoutMs,
    keepAlive,
  });
  return detailed.content;
}

/**
 * Unified chat completion with execution metadata.
 * @param {{
 *   messages: Array<{role: string, content: string}>,
 *   model?: string,
 *   temperature?: number,
 *   format?: Record<string, unknown>,
 *   options?: Record<string, unknown>,
 *   timeoutMs?: number,
 *   keepAlive?: string,
 * }} params
 */
export async function chatCompletionWithMeta({
  messages,
  model,
  temperature = 0,
  format,
  options,
  timeoutMs = 120_000,
  keepAlive,
}) {
  const env = getEnv();

  if (!env.LLM_ENABLED) {
    throw new AppError(503, 'LLM disabled via configuration', 'LLM_ERROR');
  }

  const provider = env.LLM_PROVIDER;
  const fallbackProvider = resolveFallbackProvider(provider, env);
  const targetModel = model || env.LLM_MODEL;
  const providersToTry = [provider, fallbackProvider].filter((p, i, arr) => p && arr.indexOf(p) === i);
  const failures = [];

  const startedAt = Date.now();
  let attemptCount = 0;
  for (const p of providersToTry) {
    if (!canUseProvider(p, env)) {
      failures.push(`${p}: not configured`);
      continue;
    }
    try {
      attemptCount += 1;
      const out = await requestProviderCompletion(p, {
        env,
        targetModel,
        messages,
        temperature,
        format,
        options,
        timeoutMs,
        keepAlive,
      });
      return {
        ...out,
        requestedProvider: provider,
        status: p === provider ? 'SUCCESS' : 'FALLBACK',
        attemptCount,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      failures.push(`${p}: ${err.message}`);
    }
  }

  throw new AppError(503, `LLM unavailable (${failures.join(' | ')})`, 'LLM_ERROR');
}
