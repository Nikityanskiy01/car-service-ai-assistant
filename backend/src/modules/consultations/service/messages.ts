import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { mergeExtracted } from '../../../lib/consultationProgress.js';
import { assertGuestMessageQuota } from '../../../lib/llmQuota.js';
import { buildConsultationState } from '../../../services/consultationFlowService.js';
import { createAndEnqueueDiagnosisJob } from '../../../services/diagnosisJob.service.js';
import { detectServiceType } from '../../../services/consultationIntent.service.js';
import { answerServiceHistoryQuestion } from '../../../services/serviceHistoryLookup.service.js';
import { assertActorCanPost } from './access.js';
import { persistConsultationTurn } from './persist.js';
import { getSessionDetail } from './sessions.js';

export async function postMessage(sessionId, actor, content, onProgress = undefined) {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new AppError(400, 'Введите сообщение.', 'BAD_REQUEST');

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      messages: { orderBy: { createdAt: 'asc' } },
      serviceRequest: true,
    },
  });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  assertActorCanPost(session, actor);
  await assertGuestMessageQuota(sessionId, actor);
  if (session.status === 'COMPLETED' || session.serviceRequest) {
    throw new AppError(400, 'Консультация уже завершена. Начните новую сессию или оформите заявку.', 'CLOSED');
  }
  if (session.status === 'ABANDONED') {
    throw new AppError(400, 'Сессия была прервана. Пожалуйста, начните новую консультацию.', 'ABANDONED');
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

  const historyAnswer = await answerServiceHistoryQuestion({
    clientId: session.clientId,
    vehicleId: session.vehicleId,
    message: trimmed,
  });

  if (historyAnswer?.handled) {
    const priorFlow =
      session.flowState && typeof session.flowState === 'object' && !Array.isArray(session.flowState)
        ? session.flowState
        : {};
    await prisma.$transaction([
      prisma.message.create({
        data: { sessionId, sender: 'ASSISTANT', content: historyAnswer.assistant_message },
      }),
      prisma.consultationSession.update({
        where: { id: sessionId },
        data: {
          flowState: {
            ...priorFlow,
            stage: 'SERVICE_HISTORY',
            intent: 'service',
            service_type: 'oil_change',
            maintenance_cta: historyAnswer.maintenance_cta || null,
            service_history_plan: historyAnswer.plan || null,
          },
        },
      }),
    ]);
    return getSessionDetail(sessionId, actor);
  }

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
