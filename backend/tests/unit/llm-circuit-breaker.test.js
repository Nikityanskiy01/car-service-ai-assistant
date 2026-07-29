import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  __resetCircuitBreakerForTests,
  getCircuitBreakerSnapshot,
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
} from '../../src/lib/llmCircuitBreaker.js';

describe('llmCircuitBreaker', () => {
  beforeEach(() => {
    __resetCircuitBreakerForTests();
    process.env.LLM_CIRCUIT_BREAKER_ENABLED = 'true';
    process.env.LLM_CIRCUIT_FAILURE_THRESHOLD = '3';
    process.env.LLM_CIRCUIT_COOLDOWN_MS = '1000';
  });

  it('opens after threshold failures', () => {
    recordCircuitFailure();
    recordCircuitFailure();
    expect(isCircuitOpen()).toBe(false);
    recordCircuitFailure();
    expect(isCircuitOpen()).toBe(true);
    expect(getCircuitBreakerSnapshot().state).toBe('open');
  });

  it('resets after success', () => {
    recordCircuitFailure();
    recordCircuitSuccess();
    expect(getCircuitBreakerSnapshot().failures).toBe(0);
  });
});
