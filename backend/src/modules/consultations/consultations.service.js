import { randomBytes } from 'crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isExtractedComplete, mergeExtracted } from '../../lib/consultationProgress.js';
import { estimateCostFromMinor } from '../../lib/pricing.js';
import { coerceDiagnosisLine } from './consultationAi.service.js';
import { indexConsultationCase } from '../../services/caseMemoryIndexer.service.js';
import { lookupObdCodes } from '../../lib/obdCodeCatalog.js';
import { parseObdCodes } from '../../lib/obdCodes.js';
import { analyzeVehiclePhoto } from '../../services/visionService.js';
import {
  BOOTSTRAP_ASSISTANT_MESSAGE,
  buildConsultationState,
  progressFromConsultationSteps,
  progressFromStage,
} from '../../services/consultationFlowService.js';
import { createAndEnqueueDiagnosisJob } from '../../services/diagnosisJob.service.js';
import { detectServiceType } from '../../services/consultationIntent.service.js';

const sessionDetailInclude = {
  client: { select: { id: true, fullName: true, phone: true, email: true, emailProfile: true } },
  extracted: true,
  messages: { orderBy: { createdAt: 'asc' } },
  recommendations: true,
  serviceCategory: true,
  serviceRequest: true,
  diagnosisJob: true,
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
        flowState: { asked_questions: [], stage: 'INITIAL', intent: null, service_type: null },
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
  let session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: sessionDetailInclude,
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  assertActorCanReadSession(session, actor);
  if (!Array.isArray(session.messages) || session.messages.length === 0) {
    await bootstrapOpeningTurn(sessionId);
    session = await prisma.consultationSession.findUnique({
      where: { id: sessionId },
      include: sessionDetailInclude,
    });
  }
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
      obdCodes: afterUser.extracted?.obdCodes ?? null,
    },
    {
      make: ai.extracted_data.car_make,
      model: ai.extracted_data.car_model,
      year: ai.extracted_data.year,
      mileage: ai.extracted_data.mileage,
      symptoms: ai.extracted_data.symptoms,
      problemConditions: ai.extracted_data.conditions,
      obdCodes: ai.extracted_data.obd_codes,
    },
  );

  const priorFlow =
    session.flowState && typeof session.flowState === 'object' && !Array.isArray(session.flowState)
      ? session.flowState
      : {};

  if (ai.stage === 'DIAGNOSIS_QUEUED') {
    await persistConsultationTurn(sessionId, { ai, mergedExtracted, priorFlow, actor });
    const job = await createAndEnqueueDiagnosisJob(sessionId, ai.diagnosis_payload || {});
    await prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        flowState: {
          ...priorFlow,
          ...(ai.flowState ?? {}),
          diagnosis_job_id: job.id,
          diagnosis_job_status: 'PENDING',
          stage: 'DIAGNOSIS_QUEUED',
        },
      },
    });
    return getSessionDetail(sessionId, actor);
  }

  await persistConsultationTurn(sessionId, { ai, mergedExtracted, priorFlow, actor });
  return getSessionDetail(sessionId, actor);
}

async function persistConsultationTurn(sessionId, { ai, mergedExtracted, priorFlow, actor }) {
  const isManualReview = ai.stage === 'MANUAL_REVIEW_REQUIRED';
  const isQueued = ai.stage === 'DIAGNOSIS_QUEUED';
  const complete = ai.stage === 'COMPLETED' || isManualReview;

  const progressPercent = isQueued
    ? 85
    : complete
      ? 100
      : Math.min(100, progressFromStage(ai.stage) || progressFromConsultationSteps(ai.extracted_data));
  const diagnosis = ai.diagnosis;
  const obdCodesList = parseObdCodes(mergedExtracted.obdCodes || '');
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
    diagnosis && diagnosis.analysis_available !== false && Number.isFinite(Number(diagnosis.confidence))
      ? Math.max(0, Math.min(100, Math.round(Number(diagnosis.confidence) * 100)))
      : null;
  const costFromMinor =
    diagnosis?.analysis_available !== false &&
    diagnosis?.estimated_cost_from != null &&
    Number(diagnosis.estimated_cost_from) > 0
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
        obdCodes: mergedExtracted.obdCodes ?? null,
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
          ...(priorFlow.photo_observations ? { photo_observations: priorFlow.photo_observations } : {}),
          ...(obdCodesList.length ? { obd_interpretations: lookupObdCodes(obdCodesList) } : {}),
          ...(diagnosis
            ? {
                diagnosis: {
                  summary: String(diagnosis.summary || ''),
                  urgency: String(diagnosis.urgency || 'low'),
                  confidence: Number.isFinite(Number(diagnosis.confidence))
                    ? Math.max(0, Math.min(1, Number(diagnosis.confidence)))
                    : null,
                  estimated_cost_from:
                    diagnosis.estimated_cost_from != null && Number.isFinite(Number(diagnosis.estimated_cost_from))
                      ? Math.max(0, Math.round(Number(diagnosis.estimated_cost_from)))
                      : null,
                  recommended_checks: Array.isArray(diagnosis.recommended_checks)
                    ? diagnosis.recommended_checks.map((x) => String(x)).filter(Boolean).slice(0, 8)
                    : [],
                  probable_causes: Array.isArray(diagnosis.probable_causes)
                    ? diagnosis.probable_causes.map((x) => String(x)).filter(Boolean).slice(0, 8)
                    : [],
                  status: String(diagnosis.status || 'SUCCESS'),
                  analysis_available: diagnosis.analysis_available !== false,
                  reason: diagnosis.reason ? String(diagnosis.reason) : null,
                  disclaimer: String(diagnosis.disclaimer || ''),
                  execution_meta:
                    diagnosis.execution_meta && typeof diagnosis.execution_meta === 'object'
                      ? diagnosis.execution_meta
                      : null,
                },
              }
            : {}),
          ...(diagnosis?.recommended_checks?.length ? { recommended_checks: diagnosis.recommended_checks } : {}),
        },
      },
    }),
  ]);

  if (complete) {
    void indexConsultationCase(sessionId).catch((err) => {
      import('../../lib/logger.js').then(({ logger }) =>
        logger.warn(
          { sessionId, err: err instanceof Error ? err.message : String(err) },
          'case memory index failed',
        ),
      );
    });
  }

  if (complete && actor?.kind === 'owner' && actor.user?.id) {
    try {
      await autoSaveReport(sessionId, actor.user.id);
    } catch (e) {
      const { logger } = await import('../../lib/logger.js');
      logger.warn({ err: e, sessionId }, 'autoSaveReport failed');
    }
  }
}

export async function finalizeDiagnosisForSession(sessionId, diagnosis, payload) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session || session.serviceRequest) return;

  const mergedExtracted = {
    make: payload.car_make ?? session.extracted?.make ?? null,
    model: payload.car_model ?? session.extracted?.model ?? null,
    year: payload.year ?? session.extracted?.year ?? null,
    mileage: payload.mileage ?? session.extracted?.mileage ?? null,
    symptoms: payload.symptoms ?? session.extracted?.symptoms ?? null,
    problemConditions: payload.conditions ?? session.extracted?.problemConditions ?? null,
    obdCodes: payload.obd_codes ?? session.extracted?.obdCodes ?? null,
  };

  const isManual = String(diagnosis?.status || '').toUpperCase() === 'MANUAL_REVIEW_REQUIRED';
  const isService = payload.intent === 'service';
  const st = isService ? detectServiceType(String(mergedExtracted.symptoms || '')) : null;

  const priorFlow =
    session.flowState && typeof session.flowState === 'object' && !Array.isArray(session.flowState)
      ? session.flowState
      : {};

  const ai = {
    stage: isManual ? 'MANUAL_REVIEW_REQUIRED' : 'COMPLETED',
    assistant_message: isManual
      ? String(diagnosis?.summary || 'Требуется ручная обработка.')
      : `${String(diagnosis?.summary || '')}\n\nВы можете сохранить отчёт и оформить заявку в сервис.`,
    diagnosis,
    extracted_data: payload,
    flowState: {
      ...priorFlow,
      stage: isManual ? 'MANUAL_REVIEW_REQUIRED' : 'COMPLETED',
      intent: payload.intent || priorFlow.intent || 'diagnostic',
      service_type: st || payload.service_type || priorFlow.service_type || null,
      diagnosis_job_status: 'COMPLETED',
    },
  };

  await persistConsultationTurn(sessionId, {
    ai,
    mergedExtracted,
    priorFlow,
    actor: session.clientId ? { kind: 'owner', user: { id: session.clientId } } : { kind: 'guest' },
  });
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

/**
 * @param {string} sessionId
 * @param {ConsultationActor} actor
 * @param {{ mimeType: string, imageBase64: string }} payload
 */
export async function analyzeConsultationPhoto(sessionId, actor, payload) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  assertActorCanPost(session, actor);
  if (session.status === 'COMPLETED' || session.serviceRequest) {
    throw new AppError(400, 'Consultation is closed', 'CLOSED');
  }

  const mimeType = String(payload?.mimeType || '').trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new AppError(400, 'Unsupported image type', 'BAD_REQUEST');
  }
  const imageBase64 = String(payload?.imageBase64 || '').trim();
  if (imageBase64.length < 100 || imageBase64.length > 6_000_000) {
    throw new AppError(400, 'Invalid image payload', 'BAD_REQUEST');
  }

  const vision = await analyzeVehiclePhoto({ mimeType, imageBase64 });
  const priorFlow =
    session.flowState && typeof session.flowState === 'object' && !Array.isArray(session.flowState)
      ? session.flowState
      : {};

  const photo_observations = {
    observations: vision.observations || [],
    summary: vision.summary || '',
    disclaimer: vision.disclaimer || '',
    analyzedAt: new Date().toISOString(),
  };

  await prisma.consultationSession.update({
    where: { id: sessionId },
    data: {
      flowState: {
        ...priorFlow,
        photo_observations,
      },
    },
  });

  await prisma.message.create({
    data: {
      sessionId,
      sender: 'SYSTEM',
      content:
        vision.observations?.length
          ? `📷 По фото: ${vision.observations.slice(0, 3).join('; ')}`
          : '📷 Фото получено. Для анализа уточните симптомы текстом.',
    },
  });

  return {
    photo_observations,
    analysis_available: vision.analysis_available !== false,
  };
}
