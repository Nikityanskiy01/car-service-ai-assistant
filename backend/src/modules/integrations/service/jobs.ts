import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { processPendingJobs } from './outbox.js';

export async function listJobs(connectionId, { status, page = 1, pageSize = 20 }: any = {}) {
  const where = {
    connectionId,
    ...(status ? { status } : {}),
  };
  const take = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  const [items, total] = await prisma.$transaction([
    prisma.integrationJob.findMany({
      where,
      include: { attempts: { orderBy: { startedAt: 'desc' }, take: 3 } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.integrationJob.count({ where }),
  ]);
  return { items, total, page: Math.max(1, Number(page) || 1), pageSize: take };
}

export async function retryJob(jobId) {
  const row = await prisma.integrationJob.findUnique({ where: { id: jobId } });
  if (!row) throw new AppError(404, 'Задача синхронизации не найдена', 'NOT_FOUND');
  await prisma.integrationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
  return processPendingJobs();
}

export async function cancelJob(jobId) {
  await prisma.integrationJob.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  });
}
