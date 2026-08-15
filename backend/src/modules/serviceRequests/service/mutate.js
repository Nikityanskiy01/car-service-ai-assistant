import { apiMessages } from '../../../config/apiMessages.js';
import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { enqueueOutboxEvent } from '../../integrations/integrations.service.js';
import { logStatusChange } from './helpers.js';

export async function patchRequestStatus(requestId, user, { status, expectedVersion }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  if (expectedVersion == null || !Number.isInteger(expectedVersion)) {
    throw new AppError(400, apiMessages.serviceRequest.expectedVersionRequired, 'BAD_REQUEST');
  }

  const existing = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const data = {
    status,
    version: { increment: 1 },
    assignedManagerId: existing.assignedManagerId || user.id,
  };
  if (!existing.firstResponseAt && status !== 'NEW') {
    data.firstResponseAt = new Date();
  }

  const result = await prisma.serviceRequest.updateMany({
    where: { id: requestId, version: expectedVersion },
    data,
  });
  if (result.count === 0) {
    throw new AppError(409, 'Конфликт версий. Обновите данные и повторите действие.', 'CONFLICT');
  }
  await logStatusChange({
    requestId,
    actorId: user.id,
    fromStatus: existing.status,
    toStatus: status,
  });
  const row = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  await enqueueOutboxEvent({
    eventType: 'request.updated',
    entityType: 'service_request',
    entityId: requestId,
    payloadJson: { status },
  });
  return row;
}

export async function assignRequestToManager(requestId, user) {
  return assignRequestToManagerId(requestId, user, user.id);
}

export async function assignRequestToManagerId(requestId, user, managerId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const target = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, fullName: true, role: true, blocked: true },
  });
  if (!target || target.blocked) {
    throw new AppError(400, 'Менеджер не найден или заблокирован', 'BAD_REQUEST');
  }
  if (target.role !== 'MANAGER' && target.role !== 'ADMINISTRATOR') {
    throw new AppError(400, 'Пользователь не может быть назначен менеджером', 'BAD_REQUEST');
  }
  const row = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!row) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  return prisma.serviceRequest.update({
    where: { id: requestId },
    data: { assignedManagerId: managerId, version: { increment: 1 } },
    include: { assignedManager: { select: { id: true, fullName: true } } },
  });
}

export async function listStaffManagers() {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['MANAGER', 'ADMINISTRATOR'] }, blocked: false },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, email: true, role: true },
  });
  return { items: rows };
}

export async function bulkPatchStatuses(user, { ids, status }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const uniqueIds = Array.from(new Set((ids || []).map((v) => String(v))));
  if (!uniqueIds.length) throw new AppError(400, 'Нужно передать список заявок', 'BAD_REQUEST');
  const rows = await prisma.serviceRequest.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, status: true },
  });
  const result = await prisma.serviceRequest.updateMany({
    where: { id: { in: uniqueIds } },
    data: { status, version: { increment: 1 } },
  });
  await Promise.all(
    rows.map((row) =>
      logStatusChange({
        requestId: row.id,
        actorId: user.id,
        fromStatus: row.status,
        toStatus: status,
      }),
    ),
  );
  return { updated: result.count };
}

export async function bulkAssignToManager(user, { ids, managerId }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const uniqueIds = Array.from(new Set((ids || []).map((v) => String(v))));
  if (!uniqueIds.length) throw new AppError(400, 'Нужно передать список заявок', 'BAD_REQUEST');
  const targetId = managerId || user.id;
  if (managerId) {
    const target = await prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, role: true, blocked: true },
    });
    if (!target || target.blocked || (target.role !== 'MANAGER' && target.role !== 'ADMINISTRATOR')) {
      throw new AppError(400, 'Менеджер не найден', 'BAD_REQUEST');
    }
  }
  const result = await prisma.serviceRequest.updateMany({
    where: { id: { in: uniqueIds } },
    data: { assignedManagerId: targetId, version: { increment: 1 } },
  });
  return { updated: result.count };
}
