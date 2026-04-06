import { randomBytes } from 'crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isExtractedComplete, mergeExtracted } from '../../lib/consultationProgress.js';
import { estimateCostFromMinor } from '../../lib/pricing.js';
import { coerceDiagnosisLine } from './consultationAi.service.js';
import {
  BOOTSTRAP_ASSISTANT_MESSAGE,
  buildConsultationState,
  progressFromConsultationSteps,
} from '../../services/consultationFlowService.js';

const sessionDetailInclude = {
  client: { select: { id: true, fullName: true, phone: true, email: true, emailProfile: true } },
  extracted: true,
  messages: { orderBy: { createdAt: 'asc' } },
  recommendations: true,
  serviceCategory: true,
  serviceRequest: true,
};

/**
 * @typedef {{ kind: 'staff', user: { id: string, role: string } } | { kind: 'owner', user: { id: string } } | { kind: 'guest' }} ConsultationActor
 */

/** @param {import('@prisma/client').ConsultationSession} session @param {ConsultationActor} actor */
function assertActorCanReadSession(session, actor) {
  if (actor.kind === 'staff') return;
  if (actor.kind === 'owner') {
    if (session.clientId !== actor.user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  if (actor.kind === 'guest') {
    if (session.clientId != null) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

/** @param {import('@prisma/client').ConsultationSession} session @param {ConsultationActor} actor */
function assertActorCanPost(session, actor) {
  if (actor.kind === 'staff') throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  if (actor.kind === 'owner') {
    if (session.clientId !== actor.user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  if (actor.kind === 'guest') {
    if (session.clientId != null) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function createSessionForClient(clientId, { serviceCategoryId } = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Unknown service category', 'BAD_REQUEST');
  }
  const row = await prisma.consultationSession.create({
    data: {
      clientId,
      guestToken: null,
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
  await bootstrapOpeningTurn(row.id);
  return prisma.consultationSession.findUnique({
    where: { id: row.id },
    include: { extracted: true, serviceCategory: true },
  });
}

export async function createGuestSession({ serviceCategoryId } = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Unknown service category', 'BAD_REQUEST');
  }
  const guestToken = randomBytes(32).toString('hex');
  const row = await prisma.consultationSession.create({
    data: {
      clientId: null,
      guestToken,
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
  await bootstrapOpeningTurn(row.id);
  const full = await prisma.consultationSession.findUnique({
    where: { id: row.id },
    include: { extracted: true, serviceCategory: true },
  });
  return { session: full, guestToken };
}

export async function bootstrapOpeningTurn(sessionId) {
  const preliminaryNote =
    'Ответ носит информационный характер и не заменяет осмотр автомобиля в сервисе.';
  await prisma.$transaction([
    prisma.message.create({
      data: { sessionId, sender: 'ASSISTANT', content: BOOTSTRAP_ASSISTANT_MESSAGE },
    }),
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        preliminaryNote,
        flowState: { asked_questions: [], stage: 'clarification', intent: null, service_type: null },
      },
    }),
  ]);
}

export async function claimSession(sessionId, clientId, guestToken) {
  const t = String(guestToken || '').trim();
  if (!t) throw new AppError(400, 'guestToken required', 'BAD_REQUEST');
  const session = await prisma.consultationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId) throw new AppError(409, 'Session already linked to account', 'CONFLICT');
  if (session.guestToken !== t) throw new AppError(403, 'Invalid guest token', 'FORBIDDEN');
  await prisma.$transaction([
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: { clientId, guestToken: null },
    }),
    // If a guest already created a service request for this session,
    // attach it to the new account so it appears in the client's dashboard.
    prisma.serviceRequest.updateMany({
      where: { consultationSessionId: sessionId, clientId: null },
      data: {
        clientId,
        guestName: null,
        guestPhone: null,
        guestEmail: null,
      },
    }),
  ]);
  return getSessionDetail(sessionId, { kind: 'owner', user: { id: clientId } });
}

export async function listSessions(clientId, { limit = 50, offset = 0 } = {}) {
  return prisma.consultationSession.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
    include: {
      extracted: true,
      serviceRequest: { select: { id: true, status: true } },
    },
  });
}

/** Список ИИ-сессий для менеджера / администратора (без гостевого токена). */
export async function listSessionsForStaff({ limit = 500, offset = 0 } = {}) {
  const take = Math.min(Math.max(1, limit), 500);
  const skip = Math.max(0, offset);
  const include = {
    client: { select: { id: true, fullName: true, phone: true, email: true, emailProfile: true } },
    extracted: true,
    serviceRequest: { select: { id: true, status: true } },
    serviceCategory: { select: { id: true, name: true } },
  };
  const [items, total] = await prisma.$transaction([
    prisma.consultationSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include,
    }),
    prisma.consultationSession.count(),
  ]);
  return { items, total };
}

export async function getSessionDetail(sessionId, actor) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: sessionDetailInclude,
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  assertActorCanReadSession(session, actor);
  return session;
}

export async function postMessage(sessionId, actor, content, onProgress) {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new AppError(400, 'Message required', 'BAD_REQUEST');

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      messages: { orderBy: { createdAt: 'asc' } },
      serviceRequest: true,
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  assertActorCanPost(session, actor);
  if (session.status === 'COMPLETED' || session.serviceRequest) {
    throw new AppError(400, 'Consultation is closed', 'CLOSED');
  }
  if (session.status === 'ABANDONED') {
    throw new AppError(400, 'Session abandoned', 'ABANDONED');
  }

  await prisma.message.create({
    data: { sessionId, sender: 'USER', content: trimmed },
  });

  const afterUser = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  const ai = await buildConsultationState(afterUser, trimmed, onProgress);
  const mergedExtracted = mergeExtracted(
    {
      make: afterUser.extracted?.make ?? null,
      model: afterUser.extracted?.model ?? null,
      year: afterUser.extracted?.year ?? null,
      mileage: afterUser.extracted?.mileage ?? null,
      symptoms: afterUser.extracted?.symptoms ?? null,
      problemConditions: afterUser.extracted?.problemConditions ?? null,
    },
    {
      make: ai.extracted_data.car_make,
      model: ai.extracted_data.car_model,
      year: ai.extracted_data.year,
      mileage: ai.extracted_data.mileage,
      symptoms: ai.extracted_data.symptoms,
      problemConditions: ai.extracted_data.conditions,
    },
  );

  const complete = ai.stage === 'result' || ai.stage === 'service_result';

  const progressPercent = complete
    ? 100
    : Math.min(100, progressFromConsultationSteps(ai.extracted_data));
  const diagnosis = ai.diagnosis;
  const recommendations =
    diagnosis?.probable_causes?.length > 0
      ? diagnosis.probable_causes
          .map((title, i) => ({
            title: coerceDiagnosisLine(title),
            probabilityPercent: Math.max(15, Math.round(75 - i * 12)),
          }))
          .filter((r) => r.title)
      : [];
  const aiReply = ai.assistant_message;
  const confidencePercent =
    diagnosis && Number.isFinite(Number(diagnosis.confidence))
      ? Math.max(0, Math.min(100, Math.round(Number(diagnosis.confidence) * 100)))
      : null;
  const costFromMinor =
    diagnosis?.estimated_cost_from != null && Number(diagnosis.estimated_cost_from) > 0
      ? Math.round(Number(diagnosis.estimated_cost_from))
      : complete
        ? estimateCostFromMinor(mergedExtracted, { recommendations })
        : null;

  await prisma.$transaction([
    prisma.message.create({
      data: { sessionId, sender: 'ASSISTANT', content: aiReply },
    }),
    prisma.extractedDiagnosticData.update({
      where: { sessionId },
      data: {
        make: mergedExtracted.make ?? null,
        model: mergedExtracted.model ?? null,
        year: mergedExtracted.year ?? null,
        mileage: mergedExtracted.mileage ?? null,
        symptoms: mergedExtracted.symptoms ?? null,
        problemConditions: mergedExtracted.problemConditions ?? null,
      },
    }),
    prisma.diagnosticRecommendation.deleteMany({ where: { sessionId } }),
    ...recommendations.map((r) =>
      prisma.diagnosticRecommendation.create({
        data: {
          sessionId,
          title: r.title,
          probabilityPercent: r.probabilityPercent,
        },
      }),
    ),
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        status: complete ? 'COMPLETED' : 'IN_PROGRESS',
        progressPercent: Math.min(100, progressPercent),
        confidencePercent,
        costFromMinor: costFromMinor != null && Number.isFinite(costFromMinor) ? Math.round(costFromMinor) : null,
        preliminaryNote: 'Результат предварительный и не заменяет очную диагностику автомобиля специалистом.',
        flowState: {
          ...(ai.flowState ?? {}),
          ...(diagnosis?.recommended_checks?.length ? { recommended_checks: diagnosis.recommended_checks } : {}),
        },
      },
    }),
  ]);

  if (complete && actor.kind === 'owner' && actor.user?.id) {
    try {
      await autoSaveReport(sessionId, actor.user.id);
    } catch (e) {
      const { logger } = await import('../../lib/logger.js');
      logger.warn({ err: e, sessionId }, 'autoSaveReport failed');
    }
  }

  return getSessionDetail(sessionId, actor);
}

async function autoSaveReport(sessionId, userId) {
  const count = await prisma.consultationReport.count({
    where: { consultationSessionId: sessionId, userId },
  });
  if (count > 0) return;

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      recommendations: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 80 },
    },
  });
  if (!session) return null;

  const snapshotJson = {
    sessionId: session.id,
    status: session.status,
    progressPercent: session.progressPercent,
    confidencePercent: session.confidencePercent,
    costFromMinor: session.costFromMinor,
    preliminaryNote: session.preliminaryNote,
    extracted: session.extracted,
    recommendations: session.recommendations,
    messages: session.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    savedAt: new Date().toISOString(),
  };

  return prisma.consultationReport.create({
    data: {
      userId,
      consultationSessionId: sessionId,
      snapshotJson,
      label: `Отчёт ${new Date().toLocaleDateString('ru-RU')}`,
    },
  });
}

export async function saveReport(sessionId, userId, { label } = {}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      recommendations: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 80 },
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId !== userId) throw new AppError(403, 'Forbidden', 'FORBIDDEN');

  const ext = session.extracted;
  if (!isExtractedComplete(ext) && session.status !== 'COMPLETED') {
    throw new AppError(400, 'Complete consultation before saving report', 'INCOMPLETE');
  }

  const snapshotJson = {
    sessionId: session.id,
    status: session.status,
    progressPercent: session.progressPercent,
    confidencePercent: session.confidencePercent,
    costFromMinor: session.costFromMinor,
    preliminaryNote: session.preliminaryNote,
    extracted: ext,
    recommendations: session.recommendations,
    messages: session.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    savedAt: new Date().toISOString(),
  };

  return prisma.consultationReport.create({
    data: {
      userId,
      consultationSessionId: sessionId,
      snapshotJson,
      label: label ? String(label).slice(0, 200) : null,
    },
  });
}

export async function listMyReports(userId, { limit = 50, offset = 0 } = {}) {
  return prisma.consultationReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
  });
}
