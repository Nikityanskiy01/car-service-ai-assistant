import { apiMessages } from '../../config/apiMessages.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
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
    throw new AppError(400, apiMessages.serviceRequest.incompleteConsultation, 'INCOMPLETE');
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

  const full = await findFullServiceRequest(sr.id);
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
    throw new AppError(400, apiMessages.serviceRequest.incompleteConsultation, 'INCOMPLETE');
  }
  const name = String(fullName || '').trim();
  const phRaw = String(phone || '').trim();
  if (!name || !phRaw) throw new AppError(400, apiMessages.serviceRequest.guestNamePhoneRequired, 'BAD_REQUEST');
  const phDigits = normalizePhone(phRaw);
  if (!isValidPhoneDigits(phDigits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  const ext = session.extracted;
  const sr = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceRequest.create({
      data: {
        clientId: null,
        guestName: name.slice(0, 120),
        guestPhone: phDigits.slice(0, 40),
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
      data: { status: 'COMPLETED', progressPercent: 100, guestName: name, guestPhone: phDigits },
    });
    return created;
  });

  const full = await findFullServiceRequest(sr.id);
  await notifyNewServiceRequest(full);
  return full;
}

function findFullServiceRequest(id) {
  return prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, fullName: true, phone: true, email: true, emailProfile: true },
      },
      consultationSession: {
        include: { messages: { orderBy: { createdAt: 'asc' } }, extracted: true, recommendations: true },
      },
    },
  });
}

export async function listRequests(
  user,
  { status, q, page = 1, pageSize = 20, sort = 'createdAt', dir = 'desc' } = {},
) {
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
  const take = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  const orderDir = dir === 'asc' ? 'asc' : 'desc';
  let orderBy;
  switch (sort) {
    case 'status':
      orderBy = { status: orderDir };
      break;
    case 'version':
      orderBy = { version: orderDir };
      break;
    case 'client':
      orderBy = [{ client: { fullName: orderDir } }, { guestName: orderDir }];
      break;
    case 'car':
      orderBy = [{ snapshotMake: orderDir }, { snapshotModel: orderDir }];
      break;
    case 'createdAt':
    default:
      orderBy = { createdAt: orderDir };
      break;
  }
  const include = {
    client: { select: { id: true, fullName: true, phone: true, email: true } },
  };
  const [items, total] = await prisma.$transaction([
    prisma.serviceRequest.findMany({
      where,
      orderBy,
      take,
      skip,
      include,
    }),
    prisma.serviceRequest.count({ where }),
  ]);
  return { items, total, page: Math.max(1, Number(page) || 1), pageSize: take };
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
    throw new AppError(400, apiMessages.serviceRequest.expectedVersionRequired, 'BAD_REQUEST');
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
