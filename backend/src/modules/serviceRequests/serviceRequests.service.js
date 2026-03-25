import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isExtractedComplete } from '../../lib/consultationProgress.js';
import { notifyNewServiceRequest } from '../notifications/telegram.service.js';

export async function createFromSession(sessionId, user) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId !== user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  if (session.serviceRequest) throw new AppError(409, 'Request already exists', 'CONFLICT');
  if (!isExtractedComplete(session.extracted)) {
    throw new AppError(400, 'All six diagnostic fields must be filled', 'INCOMPLETE');
  }

  const ext = session.extracted;
  const sr = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        clientId: user.id,
        consultationSessionId: sessionId,
        status: 'NEW',
        version: 1,
        snapshotMake: ext.make,
        snapshotModel: ext.model,
        snapshotSymptoms: ext.symptoms,
      },
    });
    await tx.consultationSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', progressPercent: 100 },
    });
    return created;
  });

  const full = await prisma.serviceRequest.findUnique({
    where: { id: sr.id },
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
      consultationSession: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          extracted: true,
          recommendations: true,
        },
      },
    },
  });

  await notifyNewServiceRequest(full);

  return full;
}

export async function createFromGuestSession(sessionId, actor, { fullName, phone, email } = {}) {
  if (!actor || actor.kind !== 'guest') throw new AppError(403, 'Forbidden', 'FORBIDDEN');

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId != null) throw new AppError(409, 'Session already linked to account', 'CONFLICT');
  if (session.serviceRequest) throw new AppError(409, 'Request already exists', 'CONFLICT');
  if (!isExtractedComplete(session.extracted)) {
    throw new AppError(400, 'All six diagnostic fields must be filled', 'INCOMPLETE');
  }
  const name = String(fullName || '').trim();
  const ph = String(phone || '').trim();
  if (!name || !ph) throw new AppError(400, 'fullName and phone required', 'BAD_REQUEST');

  const ext = session.extracted;
  const sr = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        clientId: null,
        guestName: name.slice(0, 120),
        guestPhone: ph.slice(0, 40),
        guestEmail: email ? String(email).slice(0, 120) : null,
        consultationSessionId: sessionId,
        status: 'NEW',
        version: 1,
        snapshotMake: ext.make,
        snapshotModel: ext.model,
        snapshotSymptoms: ext.symptoms,
      },
    });
    await tx.consultationSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', progressPercent: 100, guestName: name, guestPhone: ph },
    });
    return created;
  });

  const full = await prisma.serviceRequest.findUnique({
    where: { id: sr.id },
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
      consultationSession: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          extracted: true,
          recommendations: true,
        },
      },
    },
  });

  await notifyNewServiceRequest(full);
  return full;
}

export async function listRequests(user, { status, q } = {}) {
  if (user.role !== 'CLIENT' && user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const where = {};
  if (user.role === 'CLIENT') {
    where.clientId = user.id;
  }
  if (status) where.status = status;
  if (q && String(q).trim()) {
    const s = String(q).trim();
    where.OR = [
      { snapshotMake: { contains: s, mode: 'insensitive' } },
      { snapshotModel: { contains: s, mode: 'insensitive' } },
      { snapshotSymptoms: { contains: s, mode: 'insensitive' } },
    ];
  }
  return prisma.serviceRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  });
}

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
      consultationSession: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          extracted: true,
          recommendations: true,
        },
      },
    },
  });
  if (!row) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (user.role === 'CLIENT' && row.clientId !== user.id) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (user.role === 'CLIENT') return row;
  if (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') return row;
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function patchRequestStatus(requestId, user, { status, expectedVersion }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (expectedVersion == null || !Number.isInteger(expectedVersion)) {
    throw new AppError(400, 'expectedVersion required', 'BAD_REQUEST');
  }

  const result = await prisma.serviceRequest.updateMany({
    where: { id: requestId, version: expectedVersion },
    data: {
      status,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) {
    throw new AppError(409, 'Version conflict', 'CONFLICT');
  }
  return prisma.serviceRequest.findUnique({ where: { id: requestId } });
}
