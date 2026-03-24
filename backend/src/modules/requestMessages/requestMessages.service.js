import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);

export async function listMessages(requestId, user) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (user.role === 'CLIENT' && req.clientId !== user.id) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (user.role === 'CLIENT' || user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') {
    return prisma.requestFollowUpMessage.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function postMessage(requestId, user, body) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (CLOSED.has(req.status)) {
    throw new AppError(409, 'Thread is read-only for this status', 'THREAD_LOCKED');
  }

  const isClient = user.role === 'CLIENT' && req.clientId === user.id;
  const isStaff = user.role === 'MANAGER' || user.role === 'ADMINISTRATOR';
  if (!isClient && !isStaff) throw new AppError(403, 'Forbidden', 'FORBIDDEN');

  return prisma.requestFollowUpMessage.create({
    data: {
      requestId,
      authorId: user.id,
      body: String(body).trim().slice(0, 8000),
    },
    include: { author: { select: { id: true, fullName: true, role: true } } },
  });
}
