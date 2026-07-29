import { apiMessages } from '../../config/apiMessages.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { isExtractedComplete } from '../../lib/consultationProgress.js';
import { getUrgencyFromRequest } from '../../lib/requestDiagnosis.js';
import { isSlaBreached, SLA_HOURS } from '../../lib/requestSla.js';
import { getRelevantCases } from '../../services/caseMemory.service.js';
import { notifyNewServiceRequest } from '../notifications/telegram.service.js';
import { dispatchOutbox, enqueueOutboxEvent, processPendingJobs } from '../integrations/integrations.service.js';
import { exportRequestToConnection } from '../integrations/integrations.service.js';

async function logStatusChange({ requestId, actorId, fromStatus, toStatus }) {
  if (fromStatus === toStatus) return;
  await prisma.serviceRequestStatusLog.create({
    data: {
      requestId,
      actorId: actorId || null,
      fromStatus: fromStatus || null,
      toStatus,
    },
  });
}

function periodSince(period) {
  if (!period || period === 'all') return null;
  const since = new Date();
  if (period === 'today') {
    since.setHours(0, 0, 0, 0);
    return since;
  }
  if (period === '7d') {
    since.setDate(since.getDate() - 7);
    return since;
  }
  return null;
}

function hasDiagnosisInRow(row) {
  const flowState = row?.consultationSession?.flowState;
  if (!flowState || typeof flowState !== 'object' || Array.isArray(flowState)) return false;
  return Boolean(flowState.diagnosis);
}

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
  await enqueueOutboxEvent({
    eventType: 'request.created',
    entityType: 'service_request',
    entityId: sr.id,
    payloadJson: { source: 'consultation', actor: 'client' },
  });
  await dispatchOutbox();
  await processPendingJobs();
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
  await enqueueOutboxEvent({
    eventType: 'request.created',
    entityType: 'service_request',
    entityId: sr.id,
    payloadJson: { source: 'consultation', actor: 'guest' },
  });
  await dispatchOutbox();
  await processPendingJobs();
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
  {
    status,
    q,
    page = 1,
    pageSize = 20,
    sort = 'createdAt',
    dir = 'desc',
    mine,
    sla,
    feedback,
    urgency,
    statuses,
    source,
    period,
    hasDiagnosis,
  } = {},
) {
  if (user.role !== 'CLIENT' && user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const where = {};
  if (user.role === 'CLIENT') {
    where.clientId = user.id;
  }
  if (status) where.status = status;
  if (statuses?.length) {
    where.status = { in: statuses };
  }
  if (source === 'guest') {
    where.clientId = null;
  } else if (source === 'registered') {
    where.clientId = { not: null };
  } else if (source === 'contact') {
    const converted = await prisma.contactSubmission.findMany({
      where: { convertedRequestId: { not: null } },
      select: { convertedRequestId: true },
      take: 500,
    });
    const ids = converted.map((c) => c.convertedRequestId).filter(Boolean);
    where.id = ids.length ? { in: ids } : { in: ['00000000-0000-0000-0000-000000000000'] };
  }
  const since = periodSince(period);
  if (since) {
    where.createdAt = { ...(where.createdAt || {}), gte: since };
  }
  if (mine === true || mine === 'true' || mine === '1') {
    where.assignedManagerId = user.id;
  }
  if (sla === 'breached') {
    const threshold = new Date(Date.now() - SLA_HOURS * 3600000);
    where.status = { in: ['NEW', 'IN_PROGRESS'] };
    where.firstResponseAt = null;
    where.createdAt = { lt: threshold };
  }
  if (feedback === 'none') {
    where.consultationSession = { feedback: { is: null } };
  } else if (feedback && ['CORRECT', 'PARTIAL', 'INCORRECT'].includes(String(feedback).toUpperCase())) {
    where.consultationSession = { feedback: { verdict: String(feedback).toUpperCase() } };
  }
  if (q && String(q).trim()) {
    const s = String(q).trim();
    where.OR = [
      { snapshotMake: { contains: s, mode: 'insensitive' } },
      { snapshotModel: { contains: s, mode: 'insensitive' } },
      { snapshotSymptoms: { contains: s, mode: 'insensitive' } },
      { guestName: { contains: s, mode: 'insensitive' } },
      { guestPhone: { contains: s, mode: 'insensitive' } },
      { client: { fullName: { contains: s, mode: 'insensitive' } } },
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
    assignedManager: { select: { id: true, fullName: true } },
  };
  if (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') {
    include.consultationSession = {
      select: {
        feedback: { select: { id: true, verdict: true } },
        flowState: true,
        confidencePercent: true,
      },
    };
  }

  const urgencyFilter = urgency ? String(urgency).toLowerCase() : null;
  const diagnosisFilter =
    hasDiagnosis === true || hasDiagnosis === 'true' || hasDiagnosis === '1'
      ? 'yes'
      : hasDiagnosis === false || hasDiagnosis === 'false' || hasDiagnosis === '0'
        ? 'no'
        : null;
  const needsPostFilter = Boolean(urgencyFilter || diagnosisFilter);
  const fetchTake = needsPostFilter ? Math.min(take * 5, 200) : take;
  const fetchSkip = needsPostFilter ? 0 : skip;

  let items = await prisma.serviceRequest.findMany({
    where,
    orderBy,
    take: fetchTake,
    skip: fetchSkip,
    include,
  });

  if (urgencyFilter) {
    items = items.filter((row) => getUrgencyFromRequest(row) === urgencyFilter);
  }
  if (diagnosisFilter === 'yes') {
    items = items.filter((row) => hasDiagnosisInRow(row));
  } else if (diagnosisFilter === 'no') {
    items = items.filter((row) => !hasDiagnosisInRow(row));
  }
  if (needsPostFilter) {
    const totalFiltered = items.length;
    items = items.slice(skip, skip + take);
    return { items, total: totalFiltered, page: Math.max(1, Number(page) || 1), pageSize: take };
  }

  const total = await prisma.serviceRequest.count({ where });
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

  const existing = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new AppError(404, 'Not found', 'NOT_FOUND');

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
    throw new AppError(409, 'Version conflict', 'CONFLICT');
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
  await dispatchOutbox();
  await processPendingJobs();
  return row;
}

export async function assignRequestToManager(requestId, user) {
  return assignRequestToManagerId(requestId, user, user.id);
}

export async function assignRequestToManagerId(requestId, user, managerId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
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
  if (!row) throw new AppError(404, 'Not found', 'NOT_FOUND');
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
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
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

export async function getClientDossier(user, clientId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const profile = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
  });
  if (!profile) throw new AppError(404, 'Клиент не найден', 'NOT_FOUND');
  const [requests, bookings, consultations, feedbackAgg] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, status: true, createdAt: true, snapshotMake: true, snapshotModel: true },
    }),
    prisma.serviceBooking.findMany({
      where: { clientId },
      orderBy: { preferredAt: 'desc' },
      take: 30,
      select: { id: true, status: true, preferredAt: true, notes: true },
    }),
    prisma.consultationSession.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, status: true, updatedAt: true, progressPercent: true },
    }),
    prisma.consultationFeedback.aggregate({
      where: {
        repairAmountMinor: { not: null },
        session: { serviceRequest: { clientId } },
      },
      _sum: { repairAmountMinor: true },
      _count: { id: true },
    }),
  ]);
  const completedRequests = requests.filter((r) => r.status === 'COMPLETED').length;
  const metrics = {
    requestsTotal: requests.length,
    completedRequests,
    ltvMinor: feedbackAgg._sum.repairAmountMinor || 0,
    repairsWithAmount: feedbackAgg._count.id || 0,
  };
  return { profile, requests, bookings, consultations, metrics };
}

export async function getGuestDossier(user, phoneRaw) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const phone = normalizePhone(phoneRaw);
  if (!isValidPhoneDigits(phone)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  const [requests, bookings, contacts, feedbackAgg] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { guestPhone: phone },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        createdAt: true,
        snapshotMake: true,
        snapshotModel: true,
        guestName: true,
        snapshotSymptoms: true,
      },
    }),
    prisma.serviceBooking.findMany({
      where: { guestPhone: phone },
      orderBy: { preferredAt: 'desc' },
      take: 30,
      select: { id: true, status: true, preferredAt: true, notes: true, guestName: true },
    }),
    prisma.contactSubmission.findMany({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, fullName: true, message: true, status: true, createdAt: true },
    }),
    prisma.consultationFeedback.aggregate({
      where: {
        repairAmountMinor: { not: null },
        session: { serviceRequest: { guestPhone: phone } },
      },
      _sum: { repairAmountMinor: true },
      _count: { id: true },
    }),
  ]);

  const profile = {
    phone,
    fullName: requests[0]?.guestName || bookings[0]?.guestName || contacts[0]?.fullName || 'Гость',
    isGuest: true,
  };

  const completedRequests = requests.filter((r) => r.status === 'COMPLETED').length;
  const metrics = {
    requestsTotal: requests.length,
    completedRequests,
    ltvMinor: feedbackAgg._sum.repairAmountMinor || 0,
    repairsWithAmount: feedbackAgg._count.id || 0,
  };

  return { profile, requests, bookings, contacts, metrics };
}

export async function bulkAssignToManager(user, { ids, managerId }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
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

export async function listActivity(user, { limit = 15 } = {}) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const take = Math.min(Math.max(1, Number(limit) || 15), 50);

  const [requests, messages, feedbacks, contacts, crmJobs] = await Promise.all([
    prisma.serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        guestName: true,
        snapshotMake: true,
        snapshotModel: true,
        client: { select: { fullName: true } },
      },
    }),
    prisma.requestFollowUpMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        request: { select: { id: true } },
        author: { select: { fullName: true } },
      },
    }),
    prisma.consultationFeedback.findMany({
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        session: { select: { serviceRequest: { select: { id: true } } } },
        manager: { select: { fullName: true } },
      },
    }),
    prisma.contactSubmission.findMany({
      where: { status: 'CONVERTED', convertedRequestId: { not: null } },
      orderBy: { processedAt: 'desc' },
      take,
      select: { id: true, fullName: true, convertedRequestId: true, processedAt: true },
    }),
    prisma.integrationJob.findMany({
      where: {
        status: { in: ['SUCCEEDED', 'FAILED', 'DEAD_LETTER'] },
        entityType: 'service_request',
      },
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        entityId: true,
        connection: { select: { name: true } },
      },
    }),
  ]);

  const items = [];
  for (const r of requests) {
    const name = r.client?.fullName || r.guestName || 'Клиент';
    const car = [r.snapshotMake, r.snapshotModel].filter(Boolean).join(' ');
    items.push({
      id: `req-${r.id}`,
      type: 'REQUEST_CREATED',
      at: r.createdAt.toISOString(),
      title: `Новая заявка: ${name}${car ? ` · ${car}` : ''}`,
      requestId: r.id,
    });
  }
  for (const m of messages) {
    items.push({
      id: `msg-${m.id}`,
      type: 'MESSAGE_SENT',
      at: m.createdAt.toISOString(),
      title: `Сообщение клиенту · ${m.author?.fullName || 'Менеджер'}`,
      requestId: m.request?.id,
    });
  }
  for (const f of feedbacks) {
    const requestId = f.session?.serviceRequest?.id;
    items.push({
      id: `fb-${f.id}`,
      type: 'FEEDBACK_SAVED',
      at: f.updatedAt.toISOString(),
      title: `Оценка ИИ: ${f.verdict} · ${f.manager?.fullName || 'Менеджер'}`,
      requestId,
    });
  }
  for (const c of contacts) {
    items.push({
      id: `contact-${c.id}`,
      type: 'CONTACT_CONVERTED',
      at: (c.processedAt || new Date()).toISOString(),
      title: `Входящее → заявка: ${c.fullName}`,
      requestId: c.convertedRequestId,
    });
  }
  for (const job of crmJobs) {
    if (!job.entityId) continue;
    const failed = ['FAILED', 'DEAD_LETTER'].includes(job.status);
    items.push({
      id: `crm-${job.id}`,
      type: failed ? 'CRM_FAILED' : 'CRM_EXPORTED',
      at: job.updatedAt.toISOString(),
      title: failed
        ? `Ошибка CRM (${job.connection?.name || 'интеграция'})`
        : `Экспорт в CRM (${job.connection?.name || 'интеграция'})`,
      requestId: job.entityId,
    });
  }

  return {
    items: items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, take),
  };
}

export async function getSimilarCasesForRequest(user, requestId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: { consultationSession: { include: { extracted: true } } },
  });
  if (!sr) throw new AppError(404, 'Not found', 'NOT_FOUND');

  const ext = sr.consultationSession?.extracted;
  const items = await getRelevantCases(
    {
      car_make: ext?.make || sr.snapshotMake,
      car_model: ext?.model || sr.snapshotModel,
      symptoms: ext?.symptoms || sr.snapshotSymptoms,
      conditions: ext?.conditions,
    },
    5,
  );
  return { items };
}

export async function getStatusHistory(user, requestId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const row = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { id: true } });
  if (!row) throw new AppError(404, 'Not found', 'NOT_FOUND');
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

export async function bulkExportToCrm(user, { ids, connectionId }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  const uniqueIds = Array.from(new Set((ids || []).map((v) => String(v))));
  if (!uniqueIds.length) throw new AppError(400, 'Нужно передать список заявок', 'BAD_REQUEST');

  let connId = connectionId;
  if (!connId) {
    const conn = await prisma.integrationConnection.findFirst({
      where: { enabled: true, status: 'CONNECTED' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conn) throw new AppError(400, 'Нет активного подключения CRM', 'BAD_REQUEST');
    connId = conn.id;
  }

  let exported = 0;
  const errors = [];
  for (const id of uniqueIds) {
    try {
      await exportRequestToConnection(id, connId);
      exported += 1;
    } catch (err) {
      errors.push({ id, message: err?.message || 'export failed' });
    }
  }
  return { exported, failed: errors.length, errors: errors.slice(0, 5) };
}

export { isSlaBreached };
