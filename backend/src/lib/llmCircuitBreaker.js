import { getEnv } from '../config/env.js';

/** @type {{ failures: number, openedAt: number | null, halfOpenProbe: boolean }} */
let state = { failures: 0, openedAt: null, halfOpenProbe: false };

function reset() {
  state = { failures: 0, openedAt: null, halfOpenProbe: false };
}

/**
 * @returns {boolean}
 */
export function isCircuitOpen() {
  const env = getEnv();
  if (!env.LLM_CIRCUIT_BREAKER_ENABLED) return false;

  if (!state.openedAt) return false;

  const cooldownMs = env.LLM_CIRCUIT_COOLDOWN_MS;
  if (Date.now() - state.openedAt >= cooldownMs) {
    state.halfOpenProbe = true;
    return false;
  }
  return true;
}

export function recordCircuitSuccess() {
  if (state.openedAt || state.failures > 0) reset();
}

export function recordCircuitFailure() {
  const env = getEnv();
  if (!env.LLM_CIRCUIT_BREAKER_ENABLED) return;

  if (state.halfOpenProbe) {
    state.openedAt = Date.now();
    state.halfOpenProbe = false;
    state.failures = env.LLM_CIRCUIT_FAILURE_THRESHOLD;
    return;
  }

  state.failures += 1;
  if (state.failures >= env.LLM_CIRCUIT_FAILURE_THRESHOLD) {
    state.openedAt = Date.now();
  }
}

export function getCircuitBreakerSnapshot() {
  const env = getEnv();
  return {
    enabled: env.LLM_CIRCUIT_BREAKER_ENABLED,
    state: !env.LLM_CIRCUIT_BREAKER_ENABLED
      ? 'disabled'
      : isCircuitOpen()
        ? 'open'
        : state.halfOpenProbe
          ? 'half_open'
          : state.failures > 0
            ? 'degraded'
            : 'closed',
    failures: state.failures,
    threshold: env.LLM_CIRCUIT_FAILURE_THRESHOLD,
    cooldownMs: env.LLM_CIRCUIT_COOLDOWN_MS,
    openedAt: state.openedAt ? new Date(state.openedAt).toISOString() : null,
  };
}

/** For tests only. */
export function __resetCircuitBreakerForTests() {
  reset();
}
