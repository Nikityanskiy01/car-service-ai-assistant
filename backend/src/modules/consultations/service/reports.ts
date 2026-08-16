import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { isExtractedComplete } from '../../../lib/consultationProgress.js';

export async function saveReport(sessionId, userId, { label }: any = {}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      recommendations: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 80 },
    },
  });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  if (session.clientId !== userId) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');

  const ext = session.extracted;
  if (!isExtractedComplete(ext) && session.status !== 'COMPLETED') {
    throw new AppError(400, 'Сначала завершите консультацию, чтобы сохранить отчёт.', 'INCOMPLETE');
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

export async function listMyReports(userId, { limit = 50, offset = 0 }: any = {}) {
  return prisma.consultationReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
  });
}
