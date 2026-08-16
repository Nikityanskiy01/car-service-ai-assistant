import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { assertGuestMessageQuota } from '../../../lib/llmQuota.js';
import { analyzeVehiclePhoto } from '../../../services/visionService.js';
import { assertMagicMime } from '../../../lib/fileMagic.js';
import { sanitizeImageBuffer } from '../../../lib/imageSanitize.js';
import { assertActorCanPost } from './access.js';

/**
 * @param sessionId
 * @param actor
 * @param payload
 */
export async function analyzeConsultationPhoto(sessionId, actor, payload) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  assertActorCanPost(session, actor);
  await assertGuestMessageQuota(sessionId, actor);
  if (session.status === 'COMPLETED' || session.serviceRequest) {
    throw new AppError(400, 'Консультация уже завершена. Начните новую сессию или оформите заявку.', 'CLOSED');
  }

  const mimeType = String(payload?.mimeType || '').trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new AppError(400, 'Неподдерживаемый тип изображения.', 'BAD_REQUEST');
  }
  const imageBase64 = String(payload?.imageBase64 || '').trim().replace(/^data:[^;]+;base64,/, '');
  if (imageBase64.length < 100 || imageBase64.length > 6_000_000) {
    throw new AppError(400, 'Некорректные данные изображения.', 'BAD_REQUEST');
  }
  let raw;
  try {
    raw = Buffer.from(imageBase64, 'base64');
  } catch {
    throw new AppError(400, 'Некорректные данные изображения.', 'BAD_REQUEST');
  }
  if (!raw.length || raw.length > 4 * 1024 * 1024) {
    throw new AppError(400, 'Некорректные данные изображения.', 'BAD_REQUEST');
  }
  assertMagicMime(raw, mimeType);
  const clean = sanitizeImageBuffer(raw, mimeType);

  const vision: any = await analyzeVehiclePhoto({
    mimeType: clean.mimeType,
    imageBase64: clean.buffer.toString('base64'),
  });
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
