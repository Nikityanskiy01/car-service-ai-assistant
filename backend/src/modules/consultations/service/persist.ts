import prisma from '../../../lib/prisma.js';
import { estimateCostFromMinor } from '../../../lib/pricing.js';
import { coerceDiagnosisLine } from '../consultationAi.service.js';
import { indexConsultationCase } from '../../../services/caseMemoryIndexer.service.js';
import { lookupObdCodes } from '../../../lib/obdCodeCatalog.js';
import { parseObdCodes } from '../../../lib/obdCodes.js';
import {
  progressFromConsultationSteps,
  progressFromStage,
} from '../../../services/consultationFlowService.js';
import { linkSessionToVehicle } from '../../vehicles/vehicles.service.js';

export async function persistConsultationTurn(sessionId, { ai, mergedExtracted, priorFlow, actor }: any) {
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

  const sessionMeta = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    select: { clientId: true, vehicleId: true },
  });
  if (
    sessionMeta?.clientId &&
    !sessionMeta.vehicleId &&
    (mergedExtracted.make || mergedExtracted.model)
  ) {
    await linkSessionToVehicle(sessionId, sessionMeta.clientId, {
      make: mergedExtracted.make,
      model: mergedExtracted.model,
      year: mergedExtracted.year,
    });
  }

  if (complete) {
    void indexConsultationCase(sessionId).catch((err) => {
      import('../../../lib/logger.js').then(({ logger }) =>
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
      const { logger } = await import('../../../lib/logger.js');
      logger.warn({ err: e, sessionId }, 'autoSaveReport failed');
    }
  }
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
