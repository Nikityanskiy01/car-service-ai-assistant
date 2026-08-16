import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { getRelevantCases } from '../../../services/caseMemory.service.js';

export async function getRequest(requestId, user) {
  const row = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          emailProfile: true,
        },
      },
      assignedManager: { select: { id: true, fullName: true } },
      consultationSession: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          extracted: true,
          recommendations: true,
          feedback: {
            include: {
              manager: { select: { id: true, fullName: true } },
            },
          },
        },
      },
      bookings: {
        orderBy: { preferredAt: 'desc' },
        take: 3,
        select: { id: true, status: true, preferredAt: true, notes: true },
      },
    },
  });
  if (!row) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (user.role === 'CLIENT' && row.clientId !== user.id) {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  if (user.role === 'CLIENT') return row;
  if (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') return row;
  throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
}

export async function getStatusHistory(user, requestId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const row = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true } });
  if (!row) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const logs = await prisma.serviceRequestStatusLog.findMany({
    where: { requestId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { actor: { select: { id: true, fullName: true } } },
  });
  return {
    items: logs.map((log) => ({
      id: log.id,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor ? { id: log.actor.id, fullName: log.actor.fullName } : null,
    })),
  };
}

export async function getSimilarCasesForRequest(user, requestId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { consultationSession: { include: { extracted: true } } },
  });
  if (!sr) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const ext = sr.consultationSession?.extracted;
  const items = await getRelevantCases(
    {
      car_make: ext?.make || sr.snapshotMake,
      car_model: ext?.model || sr.snapshotModel,
      symptoms: ext?.symptoms || sr.snapshotSymptoms,
      conditions: (ext as any)?.conditions,
    },
    5,
  );
  return { items };
}
