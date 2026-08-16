import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

function withConnectionLimit(url: string) {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=15`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: process.env.DATABASE_URL
      ? { db: { url: withConnectionLimit(process.env.DATABASE_URL) } }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
