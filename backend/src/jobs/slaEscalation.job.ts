import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { isSlaBreached } from '../lib/requestSla.js';
import { notifySlaBreached } from '../modules/notifications/telegram.service.js';

const CHECK_INTERVAL_MS = 60 * 1000;
let timer = null;

export async function runSlaEscalationCheck() {
  const candidates = await prisma.serviceRequest.findMany({
    where: {
      status: { in: ['NEW', 'IN_PROGRESS'] },
      firstResponseAt: null,
      slaNotifiedAt: null,
    },
    include: {
      client: { select: { fullName: true, phone: true } },
    },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  let escalated = 0;
  for (const sr of candidates) {
    if (!isSlaBreached({ ...sr, createdAt: sr.createdAt.toISOString() })) continue;
    try {
      await notifySlaBreached(sr);
      await prisma.serviceRequest.update({
        where: { id: sr.id },
        data: { slaNotifiedAt: new Date() },
      });
      escalated += 1;
    } catch (err) {
      logger.warn({ err, requestId: sr.id }, 'SLA escalation failed for request');
    }
  }

  if (escalated > 0) {
    logger.info({ escalated }, 'SLA escalations sent');
  }
}

export function startSlaEscalationJob() {
  if (timer) return;
  void runSlaEscalationCheck().catch((err) => logger.warn({ err }, 'SLA escalation tick failed'));
  timer = setInterval(() => {
    void runSlaEscalationCheck().catch((err) => logger.warn({ err }, 'SLA escalation tick failed'));
  }, CHECK_INTERVAL_MS);
}

export function stopSlaEscalationJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
