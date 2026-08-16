import { getEnv } from '../config/env.js';

/** @type */
const pending = [];
let active = 0;

function pump() {
  const env = getEnv();
  const limit = Math.max(1, env.DIAGNOSIS_QUEUE_CONCURRENCY);
  while (active < limit && pending.length) {
    const job = pending.shift();
    if (!job) break;
    active += 1;
    Promise.resolve()
      .then(() => job.run())
      .then(job.resolve, job.reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

/**
 * Ограничивает параллельные LLM-диагнозы (in-process очередь).
 * При REDIS_URL в будущем можно заменить на BullMQ worker.
 * @template T
 * @param fn
 * @returns
 */
export function runDiagnosisQueued(fn) {
  return new Promise((resolve, reject) => {
    pending.push({
      run: fn,
      resolve,
      reject,
    });
    pump();
  });
}

export function getDiagnosisQueueSnapshot() {
  const env = getEnv();
  return {
    mode: env.REDIS_URL && env.DIAGNOSIS_ASYNC_ENABLED ? 'bullmq' : 'in_memory',
    concurrency: env.DIAGNOSIS_QUEUE_CONCURRENCY,
    active,
    pending: pending.length,
    asyncEnabled: env.DIAGNOSIS_ASYNC_ENABLED,
  };
}

/** For tests only. */
export function __resetDiagnosisQueueForTests() {
  pending.length = 0;
  active = 0;
}
