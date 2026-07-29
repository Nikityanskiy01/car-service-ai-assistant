import { getEnv } from '../config/env.js';
import { chatCompletion } from './ollamaService.js';
import { getCircuitBreakerSnapshot } from '../lib/llmCircuitBreaker.js';
import { getDiagnosisCacheSnapshot } from '../lib/diagnosisCache.js';
import { getDiagnosisQueueSnapshot } from './diagnosisQueue.service.js';
import { getDiagnosisQueueRuntimeSnapshot } from './diagnosisJob.service.js';
import { getLlmMetricsSnapshot } from './llmMetrics.service.js';

/**
 * @typedef {'disabled'|'ok'|'degraded'|'unavailable'} LlmHealthState
 */

/**
 * @param {ReturnType<typeof getEnv>} env
 */
export function resolveLlmModels(env) {
  const main = String(env.LLM_MODEL || '').trim();
  const extraction = String(env.LLM_EXTRACTION_MODEL || '').trim() || main;
  const diagnosis = String(env.LLM_DIAGNOSIS_MODEL || '').trim() || main;
  const embedding = String(env.LLM_EMBEDDING_MODEL || '').trim() || 'nomic-embed-text';
  return { main, extraction, diagnosis, embedding };
}

/**
 * @param {ReturnType<typeof getEnv>} env
 * @returns {LlmHealthState}
 */
export function deriveLlmHealthState(env) {
  if (!env.LLM_ENABLED) return 'disabled';
  if (env.LLM_FALLBACK_ENABLED) return 'degraded';
  return 'ok';
}

/**
 * @param {{ probe?: boolean, timeoutMs?: number }} [options]
 */
export async function getLlmStatus(options = {}) {
  const env = getEnv();
  const models = resolveLlmModels(env);
  const base = {
    enabled: env.LLM_ENABLED,
    provider: env.LLM_PROVIDER,
    fallbackEnabled: env.LLM_FALLBACK_ENABLED,
    fallbackProvider: env.LLM_FALLBACK_PROVIDER || null,
    models,
    state: deriveLlmHealthState(env),
    checkedAt: new Date().toISOString(),
  };

  if (!env.LLM_ENABLED) {
    return {
      ...base,
      state: 'disabled',
      message: 'LLM отключён через LLM_ENABLED=false',
      probe: null,
      metrics: getLlmMetricsSnapshot(),
      circuitBreaker: getCircuitBreakerSnapshot(),
      diagnosisCache: getDiagnosisCacheSnapshot(),
      diagnosisQueue: { ...getDiagnosisQueueSnapshot(), ...getDiagnosisQueueRuntimeSnapshot() },
    };
  }

  if (!options.probe) {
    return {
      ...base,
      message:
        base.state === 'degraded'
          ? 'Резервный провайдер включён — режим повышенной отказоустойчивости'
          : 'Конфигурация активна (без проверки соединения)',
      probe: null,
      metrics: getLlmMetricsSnapshot(),
      circuitBreaker: getCircuitBreakerSnapshot(),
      diagnosisCache: getDiagnosisCacheSnapshot(),
      diagnosisQueue: { ...getDiagnosisQueueSnapshot(), ...getDiagnosisQueueRuntimeSnapshot() },
    };
  }

  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 20_000;
  const startedAt = Date.now();
  try {
    const reply = await chatCompletion({
      model: models.extraction,
      temperature: 0,
      timeoutMs,
      messages: [
        { role: 'system', content: 'Ответь одним словом: ok' },
        { role: 'user', content: 'ping' },
      ],
    });
    const ok = String(reply || '').trim().length > 0;
    return {
      ...base,
      state: ok ? base.state : 'unavailable',
      message: ok ? 'Проверка соединения успешна' : 'Пустой ответ модели',
      probe: {
        ok,
        model: models.extraction,
        durationMs: Date.now() - startedAt,
        replyPreview: String(reply || '').trim().slice(0, 80),
      },
      metrics: getLlmMetricsSnapshot(),
      circuitBreaker: getCircuitBreakerSnapshot(),
      diagnosisCache: getDiagnosisCacheSnapshot(),
      diagnosisQueue: { ...getDiagnosisQueueSnapshot(), ...getDiagnosisQueueRuntimeSnapshot() },
    };
  } catch (err) {
    return {
      ...base,
      state: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
      probe: {
        ok: false,
        model: models.extraction,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      },
      metrics: getLlmMetricsSnapshot(),
      circuitBreaker: getCircuitBreakerSnapshot(),
      diagnosisCache: getDiagnosisCacheSnapshot(),
      diagnosisQueue: { ...getDiagnosisQueueSnapshot(), ...getDiagnosisQueueRuntimeSnapshot() },
    };
  }
}
