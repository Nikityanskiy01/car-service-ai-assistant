import prisma from './prisma.js';
import { logger } from './logger.js';
import { getRedisUrl, pingRedis } from './redis.js';

export function livePayload() {
  return { status: 'live', uptimeSec: Math.round(process.uptime()) };
}

export async function readyPayload() {
  const checks = { db: 'unknown', redis: 'skipped' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch (err) {
    logger.error({ err }, 'readiness: database unreachable');
    checks.db = 'disconnected';
  }

  if (getRedisUrl()) {
    try {
      const ok = await pingRedis();
      checks.redis = ok ? 'ok' : 'error';
    } catch (err) {
      logger.error({ err }, 'readiness: redis unreachable');
      checks.redis = 'error';
    }
  }

  const ready = checks.db === 'ok' && checks.redis !== 'error';
  return { status: ready ? 'ready' : 'not_ready' };
}
