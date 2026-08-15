import prisma from '../lib/prisma.js';
import { getEnv } from '../config/env.js';
import { logger } from '../lib/logger.js';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
let timer = null;

export async function expireGuestSessions() {
  const hours = getEnv().GUEST_SESSION_TTL_HOURS;
  if (!hours || hours <= 0) return 0;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stale = await prisma.consultationSession.findMany({
    where: {
      clientId: null,
      createdAt: { lt: cutoff },
      serviceRequest: { is: null },
    },
    select: { id: true },
    take: 200,
  });
  if (!stale.length) return 0;
  const ids = stale.map((row) => row.id);
  await prisma.consultationSession.deleteMany({ where: { id: { in: ids } } });
  logger.info({ count: ids.length }, 'expired guest consultation sessions');
  return ids.length;
}

export function startGuestSessionTtlJob() {
  if (timer) return;
  const env = getEnv();
  if (env.NODE_ENV === 'test') return;
  void expireGuestSessions().catch((err) => logger.warn({ err }, 'guest ttl job failed'));
  timer = setInterval(() => {
    void expireGuestSessions().catch((err) => logger.warn({ err }, 'guest ttl job failed'));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopGuestSessionTtlJob() {
  if (timer) clearInterval(timer);
  timer = null;
}
