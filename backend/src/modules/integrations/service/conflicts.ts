import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';

export async function listConflicts(connectionId = undefined) {
  const rows = await prisma.integrationConflict.findMany({
    where: connectionId ? { connectionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { connection: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    connectionName: r.connection?.name || null,
    entityType: r.entityType,
    entityId: r.internalEntityId,
    fieldName: r.field,
    localValue: r.localValue,
    externalValue: r.externalValue,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function resolveConflict(conflictId, resolution, note) {
  const statusMap = {
    KEEP_LOCAL: 'RESOLVED_LOCAL',
    ACCEPT_EXTERNAL: 'RESOLVED_EXTERNAL',
    MERGE: 'RESOLVED_MERGED',
    POSTPONE: 'POSTPONED',
  };
  const status = statusMap[String(resolution || '').toUpperCase()];
  if (!status) throw new AppError(400, 'Некорректный вариант разрешения конфликта', 'BAD_REQUEST');
  return prisma.integrationConflict.update({
    where: { id: conflictId },
    data: {
      status,
      resolutionNote: note ? String(note).slice(0, 500) : null,
      resolvedAt: ['POSTPONED'].includes(status) ? null : new Date(),
    },
  });
}

export async function listAuditLogs(connectionId) {
  return prisma.integrationAuditEvent.findMany({
    where: connectionId ? { connectionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
