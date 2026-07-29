import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { pseudoEmbedding, toFloatVector } from '../lib/vectorMath.js';

function resolveOllamaBaseUrl(raw) {
  return raw.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

function resolveOpenAiBaseUrl(raw) {
  return raw.replace(/\/$/, '');
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
 * @param {unknown} data
 * @returns {number[]}
 */
function parseEmbeddingResponse(provider, data) {
  if (provider === 'openai') {
    const vec = data?.data?.[0]?.embedding;
    return toFloatVector(vec);
  }
  return toFloatVector(data?.embedding);
}

/**
 * @param {'ollama'|'openai'} provider
 * @param {ReturnType<typeof getEnv>} env
 * @param {string} text
 * @param {number} timeoutMs
 */
async function requestEmbedding(provider, env, text, timeoutMs) {
  const model = String(env.LLM_EMBEDDING_MODEL || 'nomic-embed-text').trim();
  const input = String(text || '').slice(0, 8000);
  if (!input.trim()) return [];

  if (provider === 'openai') {
    const base = resolveOpenAiBaseUrl(env.LLM_CLOUD_BASE_URL);
    const res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(env.LLM_API_KEY || '').trim()}`,
      },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`embeddings http ${res.status}: ${t.slice(0, 160)}`);
    }
    const data = await res.json();
    return parseEmbeddingResponse('openai', data);
  }

  const base = resolveOllamaBaseUrl(env.LLM_BASE_URL);
  const res = await fetch(`${base}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`embeddings http ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  return parseEmbeddingResponse('ollama', data);
}

/**
 * @param {string} text
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<number[]>}
 */
export async function createEmbedding(text, options = {}) {
  const env = getEnv();
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 30_000;

  if (process.env.NODE_ENV === 'test') {
    return pseudoEmbedding(text, 64);
  }

  if (!env.LLM_ENABLED || !env.CASE_MEMORY_SEMANTIC_ENABLED) {
    return pseudoEmbedding(text, 64);
  }

  const provider = env.LLM_PROVIDER;
  const fallback =
    env.LLM_FALLBACK_ENABLED && env.LLM_FALLBACK_PROVIDER && env.LLM_FALLBACK_PROVIDER !== provider
      ? env.LLM_FALLBACK_PROVIDER
      : null;
  const providers = [provider, fallback].filter(Boolean);

  const failures = [];
  for (const p of providers) {
    if (!canUseProvider(p, env)) {
      failures.push(`${p}: not configured`);
      continue;
    }
    try {
      const vec = await requestEmbedding(p, env, text, timeoutMs);
      if (vec.length) return vec;
      failures.push(`${p}: empty vector`);
    } catch (err) {
      failures.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.warn({ failures }, 'embedding providers failed, using pseudo fallback');
  return pseudoEmbedding(text, 64);
}
