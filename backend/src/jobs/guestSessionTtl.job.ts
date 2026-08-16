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
  const withRequest = await prisma.consultationSession.updateMany({
    where: {
      clientId: null,
      createdAt: { lt: cutoff },
      OR: [{ guestName: { not: null } }, { guestPhone: { not: null } }],
    },
    data: { guestName: null, guestPhone: null },
  });
  if (!stale.length && !withRequest.count) return 0;
  if (stale.length) {
    const ids = stale.map((row) => row.id);
    await prisma.consultationSession.deleteMany({ where: { id: { in: ids } } });
    logger.info({ count: ids.length, anonymized: withRequest.count }, 'expired guest consultation sessions');
    return ids.length;
  }
  logger.info({ anonymized: withRequest.count }, 'anonymized guest PII on stale sessions with requests');
  return withRequest.count;
}

export function startGuestSessionTtlJob() {
  if (timer) return;
  const env = getEnv();
  if (env.NODE_ENV === 'test') return;
  void expireGuestSessions().catch((err) => logger.warn({ err }, 'guest ttl job failed'));
  timer = setInterval(() => {
    void expireGuestSessions().catch((err) => logger.warn({ err }, 'guest ttl job failed'));
  }, CHECK_INTERVAL_MS);
}

export function stopGuestSessionTtlJob() {
  if (timer) clearInterval(timer);
  timer = null;
}
