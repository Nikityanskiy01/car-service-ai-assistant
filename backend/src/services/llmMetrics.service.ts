import { metrics as otelMetrics } from '@opentelemetry/api';

const MAX_LATENCY_SAMPLES = 100;

const metrics: any = {
  totalCalls: 0,
  successes: 0,
  failures: 0,
  fallbacks: 0,
  validationFailures: 0,
  cacheHits: 0,
  circuitOpenRejections: 0,
  promptTokens: 0,
  completionTokens: 0,
  latenciesMs: [],
  lastError: null,
  lastSuccessAt: null,
  lastFailureAt: null,
};

/** @type */
let otelInstruments = null;

function otel() {
  if (!otelInstruments) {
    const meter = otelMetrics.getMeter('car-service.llm');
    otelInstruments = {
      calls: meter.createCounter('llm.calls'),
      latency: meter.createHistogram('llm.latency', { unit: 'ms' }),
    };
  }
  return otelInstruments;
}

function recordOtel(result, durationMs, extra: any = {}) {
  try {
    const inst = otel();
    inst.calls.add(1, { result, ...extra });
    if (Number.isFinite(durationMs)) inst.latency.record(durationMs, { result, ...extra });
  } catch {
    /* no MeterProvider in tests */
  }
}

function pushLatency(ms) {
  if (!Number.isFinite(ms)) return;
  metrics.latenciesMs.push(Math.round(ms));
  if (metrics.latenciesMs.length > MAX_LATENCY_SAMPLES) {
    metrics.latenciesMs.shift();
  }
}

export function recordLlmSuccess({ durationMs, status, provider, promptTokens, completionTokens }: any = {}) {
  metrics.totalCalls += 1;
  metrics.successes += 1;
  if (status === 'FALLBACK') metrics.fallbacks += 1;
  pushLatency(durationMs);
  metrics.lastSuccessAt = new Date().toISOString();
  metrics.lastError = null;
  if (provider) metrics.lastProvider = provider;
  if (Number(promptTokens) > 0) metrics.promptTokens += Number(promptTokens);
  if (Number(completionTokens) > 0) metrics.completionTokens += Number(completionTokens);
  recordOtel(status === 'FALLBACK' ? 'fallback' : 'success', durationMs, provider ? { provider } : {});
}

export function recordLlmFailure({ durationMs, error }: any = {}) {
  metrics.totalCalls += 1;
  metrics.failures += 1;
  pushLatency(durationMs);
  metrics.lastFailureAt = new Date().toISOString();
  metrics.lastError = error ? String(error).slice(0, 240) : 'unknown';
  recordOtel('failure', durationMs);
}

export function recordLlmValidationFailure() {
  metrics.validationFailures += 1;
}

export function recordDiagnosisCacheHit() {
  metrics.cacheHits += 1;
}

export function recordCircuitOpenRejection() {
  metrics.circuitOpenRejections += 1;
  metrics.failures += 1;
  metrics.lastFailureAt = new Date().toISOString();
  metrics.lastError = 'circuit_breaker_open';
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

export function getLlmMetricsSnapshot() {
  const latencies = metrics.latenciesMs;
  const total = metrics.totalCalls || 0;
  return {
    totalCalls: total,
    successes: metrics.successes,
    failures: metrics.failures,
    fallbacks: metrics.fallbacks,
    validationFailures: metrics.validationFailures,
    cacheHits: metrics.cacheHits,
    circuitOpenRejections: metrics.circuitOpenRejections,
    successRatePercent: total ? Math.round((metrics.successes / total) * 100) : 0,
    fallbackRatePercent: total ? Math.round((metrics.fallbacks / total) * 100) : 0,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      last: latencies.length ? latencies[latencies.length - 1] : null,
      samples: latencies.length,
    },
    lastError: metrics.lastError,
    lastSuccessAt: metrics.lastSuccessAt,
    lastFailureAt: metrics.lastFailureAt,
    tokens: {
      prompt: metrics.promptTokens,
      completion: metrics.completionTokens,
      total: metrics.promptTokens + metrics.completionTokens,
    },
  };
}

/** For tests only. */
export function __resetLlmMetricsForTests() {
  metrics.totalCalls = 0;
  metrics.successes = 0;
  metrics.failures = 0;
  metrics.fallbacks = 0;
  metrics.validationFailures = 0;
  metrics.cacheHits = 0;
  metrics.circuitOpenRejections = 0;
  metrics.promptTokens = 0;
  metrics.completionTokens = 0;
  metrics.latenciesMs = [];
  metrics.lastError = null;
  metrics.lastSuccessAt = null;
  metrics.lastFailureAt = null;
}
