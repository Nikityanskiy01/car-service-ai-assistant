import { writeFileSync, unlinkSync } from 'node:fs';
import { shutdownTelemetry } from './instrument.js';
import { getEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import prisma from './lib/prisma.js';
import { closeDiagnosisQueue } from './services/diagnosisJob.service.js';
import { closeRedis } from './lib/redis.js';
import { startBackgroundJobs, stopBackgroundJobs } from './runtime/backgroundJobs.js';

const READY_FILE = '/tmp/worker-ready';
const SHUTDOWN_TIMEOUT_MS = 15_000;
let shuttingDown = false;

function isPrismaUniqueConflict(err: unknown) {
  const code = (err as { code?: string; cause?: { code?: string } })?.code
    || (err as { cause?: { code?: string } })?.cause?.code;
  const message = err instanceof Error ? err.message : String(err || '');
  return code === 'P2002' || message.includes('Unique constraint failed');
}

process.on('unhandledRejection', (reason) => {
  if (isPrismaUniqueConflict(reason)) {
    logger.warn({ err: reason }, 'prisma unique conflict — worker continues');
    return;
  }
  logger.error({ err: reason }, 'unhandled promise rejection — worker continues');
});
process.on('uncaughtException', (err) => {
  if (isPrismaUniqueConflict(err)) {
    logger.warn({ err: err.message }, 'prisma unique conflict — worker continues');
    return;
  }
  logger.fatal({ err }, 'uncaught exception — worker continues');
});

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'worker shutdown');
  try {
    unlinkSync(READY_FILE);
  } catch {
    /* ignore */
  }
  try {
    await stopBackgroundJobs();
    await closeDiagnosisQueue();
    await closeRedis();
    await shutdownTelemetry();
  } catch (err) {
    logger.error({ err }, 'error stopping worker jobs');
  }
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, 'error disconnecting prisma');
  }
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  logger.flush?.();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

getEnv();
startBackgroundJobs();
writeFileSync(READY_FILE, 'ok');
logger.info('background worker listening (no http)');
setInterval(() => {
  logger.debug('worker heartbeat');
}, 30_000);
