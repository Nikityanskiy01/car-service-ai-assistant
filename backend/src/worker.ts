import { writeFileSync, unlinkSync } from 'node:fs';
import { shutdownTelemetry } from './instrument.js';
import { getEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import prisma from './lib/prisma.js';
import { closeDiagnosisQueue } from './services/diagnosisJob.service.js';
import { closeRedis } from './lib/redis.js';
import { startBackgroundJobs, stopBackgroundJobs } from './runtime/backgroundJobs.js';

const READY_FILE = '/tmp/worker-ready';
getEnv();
startBackgroundJobs();
writeFileSync(READY_FILE, 'ok');
logger.info('background worker listening (no http)');

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function gracefulShutdown(signal) {
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
  process.exit(0);
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection — worker shutting down');
  void gracefulShutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception — worker shutting down');
  void gracefulShutdown('uncaughtException');
});
