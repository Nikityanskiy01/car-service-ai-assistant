import { getEnv } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import prisma from './lib/prisma.js';

const env = getEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'server listening');
});

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function gracefulShutdown(signal) {
  logger.info({ signal }, 'shutdown signal received, closing server');

  await new Promise((resolve) => {
    server.close(() => {
      logger.info('http server closed');
      resolve();
    });
  });

  try {
    await prisma.$disconnect();
    logger.info('prisma disconnected');
  } catch (err) {
    logger.error({ err }, 'error disconnecting prisma');
  }

  setTimeout(() => {
    logger.error('forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection — shutting down');
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception — shutting down');
  gracefulShutdown('uncaughtException').finally(() => process.exit(1));
});
