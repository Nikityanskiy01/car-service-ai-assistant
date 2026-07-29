import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  buildDiagnosisCacheKey,
  clearDiagnosisCache,
  getDiagnosisCache,
  setDiagnosisCache,
} from '../../src/lib/diagnosisCache.js';

describe('diagnosisCache', () => {
  beforeEach(() => {
    clearDiagnosisCache();
    process.env.DIAGNOSIS_CACHE_ENABLED = 'true';
    process.env.DIAGNOSIS_CACHE_TTL_MS = '60000';
    process.env.DIAGNOSIS_CACHE_MAX_ENTRIES = '10';
  });

  it('returns cached diagnosis by stable key', () => {
    const payload = { car_make: 'BMW', symptoms: 'стук', conditions: 'на кочках' };
    const key = buildDiagnosisCacheKey(payload);
    const key2 = buildDiagnosisCacheKey({ ...payload, car_make: 'BMW' });
    expect(key).toBe(key2);
    setDiagnosisCache(key, { summary: 'ok' });
    expect(getDiagnosisCache(key)).toEqual({ summary: 'ok' });
  });
});
