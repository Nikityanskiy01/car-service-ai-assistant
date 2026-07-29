const MAX_LATENCY_SAMPLES = 100;

const metrics = {
  totalCalls: 0,
  successes: 0,
  failures: 0,
  fallbacks: 0,
  validationFailures: 0,
  cacheHits: 0,
  circuitOpenRejections: 0,
  latenciesMs: [],
  lastError: null,
  lastSuccessAt: null,
  lastFailureAt: null,
};

function pushLatency(ms) {
  if (!Number.isFinite(ms)) return;
  metrics.latenciesMs.push(Math.round(ms));
  if (metrics.latenciesMs.length > MAX_LATENCY_SAMPLES) {
    metrics.latenciesMs.shift();
  }
}

export function recordLlmSuccess({ durationMs, status, provider } = {}) {
  metrics.totalCalls += 1;
  metrics.successes += 1;
  if (status === 'FALLBACK') metrics.fallbacks += 1;
  pushLatency(durationMs);
  metrics.lastSuccessAt = new Date().toISOString();
  metrics.lastError = null;
  if (provider) metrics.lastProvider = provider;
}

export function recordLlmFailure({ durationMs, error } = {}) {
  metrics.totalCalls += 1;
  metrics.failures += 1;
  pushLatency(durationMs);
  metrics.lastFailureAt = new Date().toISOString();
  metrics.lastError = error ? String(error).slice(0, 240) : 'unknown';
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
  metrics.latenciesMs = [];
  metrics.lastError = null;
  metrics.lastSuccessAt = null;
  metrics.lastFailureAt = null;
}
