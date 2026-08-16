import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

function withConnectionLimit(url: string) {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=15`;
}

function createPrisma() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
    datasources: process.env.DATABASE_URL
      ? { db: { url: withConnectionLimit(process.env.DATABASE_URL) } }
      : undefined,
  });

  // stdout-лог `error` у Prisma 6 уходит в EventEmitter; без слушателя это uncaughtException.
  client.$on('error', (e) => {
    console.error(
      JSON.stringify({
        level: 50,
        time: Date.now(),
        msg: 'prisma error',
        prismaMessage: e.message,
        target: e.target,
      }),
    );
  });
  if (process.env.NODE_ENV === 'development') {
    client.$on('warn', (e) => {
      console.warn(
        JSON.stringify({
          level: 40,
          time: Date.now(),
          msg: 'prisma warn',
          prismaMessage: e.message,
        }),
      );
    });
  }
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
