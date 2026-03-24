import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  isExtractedComplete,
  mergeExtracted,
  progressFromExtracted,
} from '../../lib/consultationProgress.js';
import { runLlmTurn } from '../ai/llm.js';

export async function createSession(clientId, { serviceCategoryId } = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Unknown service category', 'BAD_REQUEST');
  }
  return prisma.consultationSession.create({
    data: {
      clientId,
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
}

export async function listSessions(clientId) {
  return prisma.consultationSession.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    include: {
      extracted: true,
      serviceRequest: { select: { id: true, status: true } },
    },
  });
}

export async function getSession(sessionId, user) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      messages: { orderBy: { createdAt: 'asc' } },
      recommendations: true,
      serviceCategory: true,
      serviceRequest: true,
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId !== user.id && user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  return session;
}

export async function postMessage(sessionId, user, content) {
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
  if (session.clientId !== user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
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

  let aiPayload;
  try {
    aiPayload = await runLlmTurn(afterUser, trimmed);
  } catch (e) {
    await prisma.consultationSession.update({
      where: { id: sessionId },
      data: { status: 'AI_ERROR' },
    });
    throw e;
  }

  const mergedExtracted = mergeExtracted(
    {
      make: afterUser.extracted?.make ?? null,
      model: afterUser.extracted?.model ?? null,
      year: afterUser.extracted?.year ?? null,
      mileage: afterUser.extracted?.mileage ?? null,
      symptoms: afterUser.extracted?.symptoms ?? null,
      problemConditions: afterUser.extracted?.problemConditions ?? null,
    },
    aiPayload.extracted,
  );

  const ruleProgress = progressFromExtracted(mergedExtracted);
  let progressPercent = Math.max(ruleProgress, aiPayload.progressPercent || 0);
  if (isExtractedComplete(mergedExtracted)) progressPercent = 100;
  progressPercent = Math.min(100, progressPercent);

  await prisma.$transaction([
    prisma.message.create({
      data: { sessionId, sender: 'ASSISTANT', content: aiPayload.reply },
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
    ...aiPayload.recommendations.map((r) =>
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
        status: 'IN_PROGRESS',
        progressPercent: Math.min(100, progressPercent),
        confidencePercent: aiPayload.confidencePercent,
        costFromMinor:
          aiPayload.costFromMinor != null && Number.isFinite(aiPayload.costFromMinor)
            ? Math.round(aiPayload.costFromMinor)
            : null,
        preliminaryNote: aiPayload.preliminaryNote,
      },
    }),
  ]);

  return getSession(sessionId, user);
}

export async function saveReport(sessionId, user, { label } = {}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      recommendations: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 80 },
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId !== user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');

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
      userId: user.id,
      consultationSessionId: sessionId,
      snapshotJson,
      label: label ? String(label).slice(0, 200) : null,
    },
  });
}

export async function listMyReports(userId) {
  return prisma.consultationReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
