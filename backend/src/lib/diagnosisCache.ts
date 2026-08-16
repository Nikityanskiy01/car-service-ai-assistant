import { createHash } from 'node:crypto';
import { getEnv } from '../config/env.js';

/** @type */
const store = new Map();

/**
 * @param payload
 */
export function buildDiagnosisCacheKey(payload) {
  const normalized = {
    car_make: payload.car_make ?? null,
    car_model: payload.car_model ?? null,
    year: payload.year ?? null,
    mileage: payload.mileage ?? null,
    symptoms: String(payload.symptoms || '').trim().toLowerCase(),
    conditions: String(payload.conditions || '').trim().toLowerCase(),
    obd_codes: String(payload.obd_codes || '').trim().toUpperCase(),
    category: payload.category ?? null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function getDiagnosisCache(key) {
  const env = getEnv();
  if (!env.DIAGNOSIS_CACHE_ENABLED) return null;

  const row = store.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return row.value;
}

export function setDiagnosisCache(key, value) {
  const env = getEnv();
  if (!env.DIAGNOSIS_CACHE_ENABLED) return;

  if (store.size >= env.DIAGNOSIS_CACHE_MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }

  store.set(key, {
    value,
    expiresAt: Date.now() + env.DIAGNOSIS_CACHE_TTL_MS,
  });
}

export function clearDiagnosisCache() {
  store.clear();
}

export function getDiagnosisCacheSnapshot() {
  const env = getEnv();
  return {
    enabled: env.DIAGNOSIS_CACHE_ENABLED,
    size: store.size,
    maxEntries: env.DIAGNOSIS_CACHE_MAX_ENTRIES,
    ttlMs: env.DIAGNOSIS_CACHE_TTL_MS,
  };
}
