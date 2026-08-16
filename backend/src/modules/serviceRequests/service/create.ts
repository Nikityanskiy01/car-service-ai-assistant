import { apiMessages } from '../../../config/apiMessages.js';
import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../../contact/contact.service.js';
import { isExtractedComplete } from '../../../lib/consultationProgress.js';
import { notifyNewServiceRequest } from '../../notifications/telegram.service.js';
import { enqueueOutboxEvent } from '../../integrations/integrations.service.js';
import { findOrCreateVehicleForClient } from '../../vehicles/vehicles.service.js';
import { findFullServiceRequest } from './helpers.js';

export async function createFromSession(sessionId, user) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  if (session.clientId !== user.id) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  if (session.serviceRequest) throw new AppError(409, 'Заявка уже создана.', 'CONFLICT');
  if (!isExtractedComplete(session.extracted)) {
    throw new AppError(400, apiMessages.serviceRequest.incompleteConsultation, 'INCOMPLETE');
  }

  const ext = session.extracted;
  const vehicle = await findOrCreateVehicleForClient(user.id, {
    make: ext.make,
    model: ext.model,
    year: ext.year,
  });
  const vehicleId = session.vehicleId || vehicle?.id || null;

  const sr = await prisma.$transaction(async (tx) => {
    if (vehicleId && !session.vehicleId) {
      await tx.consultationSession.update({
        where: { id: sessionId },
        data: { vehicleId },
      });
    }
    const created = await tx.serviceRequest.create({
      data: {
        clientId: user.id,
        consultationSessionId: sessionId,
        vehicleId,
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
  await notifyNewServiceRequest(full);
  return full;
}

export async function createFromGuestSession(sessionId, actor, { fullName, phone, email }: any = {}) {
  if (!actor || actor.kind !== 'guest') throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: { extracted: true, serviceRequest: true },
  });
  if (!session) throw new AppError(404, 'Сессия не найдена.', 'NOT_FOUND');
  if (session.clientId != null) throw new AppError(409, 'Сессия уже привязана к аккаунту.', 'CONFLICT');
  if (session.serviceRequest) throw new AppError(409, 'Заявка уже создана.', 'CONFLICT');
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
  await notifyNewServiceRequest(full);
  return full;
}
