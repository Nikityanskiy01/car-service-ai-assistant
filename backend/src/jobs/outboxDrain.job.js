import { logger } from '../lib/logger.js';
import { getEnv } from '../config/env.js';
import { dispatchOutbox, processPendingJobs } from '../modules/integrations/integrations.service.js';

const CHECK_INTERVAL_MS = 3_000;
let timer = null;
let running = false;

export async function runOutboxDrain() {
  if (running) return { skipped: true };
  running = true;
  try {
    const dispatched = await dispatchOutbox();
    await processPendingJobs();
    return dispatched;
  } finally {
    running = false;
  }
}

export function startOutboxDrainJob() {
  if (timer) return;
  const env = getEnv();
  if (env.NODE_ENV === 'test') return;
  void runOutboxDrain().catch((err) => logger.warn({ err }, 'outbox drain failed'));
  timer = setInterval(() => {
    void runOutboxDrain().catch((err) => logger.warn({ err }, 'outbox drain failed'));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopOutboxDrainJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
