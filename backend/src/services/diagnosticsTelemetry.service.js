const MAX_SAMPLES = 500;

function pushSample(arr, value) {
  arr.push(value);
  if (arr.length > MAX_SAMPLES) arr.shift();
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const copy = [...arr].sort((a, b) => a - b);
  const idx = Math.min(copy.length - 1, Math.max(0, Math.ceil((p / 100) * copy.length) - 1));
  return copy[idx];
}

const state = {
  startedAt: Date.now(),
  messageLatencyMs: [],
  llmLatencyMs: [],
  counters: {
    requests: 0,
    completed: 0,
    fallback: 0,
    llmErrors: 0,
    loopPreventions: 0,
    budgetCutoffs: 0,
    http503: 0,
    http504Signals: 0,
  },
  phaseLatency: {
    extracting: [],
    dialog: [],
    diagnosing: [],
    diagnosis_agent_step: [],
  },
};

export function telemetryInc(counter, n = 1) {
  if (!(counter in state.counters)) state.counters[counter] = 0;
  state.counters[counter] += n;
}

export function telemetryObserveMessageLatency(ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  pushSample(state.messageLatencyMs, Math.round(ms));
}

export function telemetryObserveLlmLatency(ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  pushSample(state.llmLatencyMs, Math.round(ms));
}

export function telemetryObservePhase(phase, ms) {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (!state.phaseLatency[phase]) state.phaseLatency[phase] = [];
  pushSample(state.phaseLatency[phase], Math.round(ms));
}

export function getDiagnosticsTelemetrySnapshot() {
  const uptimeSec = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
  return {
    uptimeSec,
    counters: { ...state.counters },
    latency: {
      message: {
        p50: percentile(state.messageLatencyMs, 50),
        p95: percentile(state.messageLatencyMs, 95),
        p99: percentile(state.messageLatencyMs, 99),
      },
      llm: {
        p50: percentile(state.llmLatencyMs, 50),
        p95: percentile(state.llmLatencyMs, 95),
        p99: percentile(state.llmLatencyMs, 99),
      },
      phases: Object.fromEntries(
        Object.entries(state.phaseLatency).map(([k, samples]) => [
          k,
          {
            p50: percentile(samples, 50),
            p95: percentile(samples, 95),
          },
        ]),
      ),
    },
    sloTargets: {
      messageP95Ms: 12000,
      max504RatePercent: 0.5,
    },
  };
}

export function getDiagnosticsQualityGate() {
  const snapshot = getDiagnosticsTelemetrySnapshot();
  const req = Math.max(1, Number(snapshot.counters.requests || 0));
  const p95 = Number(snapshot.latency?.message?.p95 || 0);
  const http503Rate = (Number(snapshot.counters.http503 || 0) / req) * 100;
  const signal504Rate = (Number(snapshot.counters.http504Signals || 0) / req) * 100;
  const loopRate = (Number(snapshot.counters.loopPreventions || 0) / req) * 100;

  const failures = [];
  if (p95 > 12000) failures.push(`p95=${p95}ms>12000ms`);
  if (http503Rate > 1) failures.push(`503_rate=${http503Rate.toFixed(2)}%>1%`);
  if (signal504Rate > 0.5) failures.push(`504_signal_rate=${signal504Rate.toFixed(2)}%>0.5%`);
  if (loopRate > 5) failures.push(`loop_prevention_rate=${loopRate.toFixed(2)}%>5%`);

  return {
    pass: failures.length === 0,
    recommendedAction: failures.length ? 'rollback_to_safe_flags' : 'continue_rollout',
    failures,
    snapshot,
  };
}

