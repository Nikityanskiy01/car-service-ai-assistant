import { describe, expect, it, beforeEach } from '@jest/globals';
import { shouldUseAsyncDiagnosis } from '../../src/services/diagnosisJob.service.js';

describe('diagnosis async mode', () => {
  beforeEach(() => {
    process.env.DIAGNOSIS_ASYNC_ENABLED = 'false';
    process.env.REDIS_URL = '';
  });

  it('disabled without redis', () => {
    process.env.DIAGNOSIS_ASYNC_ENABLED = 'true';
    expect(shouldUseAsyncDiagnosis()).toBe(false);
  });

  it('enabled with redis url and flag', () => {
    process.env.DIAGNOSIS_ASYNC_ENABLED = 'true';
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(shouldUseAsyncDiagnosis()).toBe(true);
  });
});
