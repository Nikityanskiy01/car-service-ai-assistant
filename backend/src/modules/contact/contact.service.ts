import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { notifyNewServiceRequest } from '../notifications/telegram.service.js';
import { enqueueOutboxEvent } from '../integrations/integrations.service.js';

/**
 * Нормализация телефона: только цифры, ведущая 8 → 7, 10 цифр без кода → +7…
 * @param raw
 */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return d;
}

/**
 * Допускаем РФ 7XXXXXXXXXX (11 цифр) или международный 10–15 цифр.
 * @param digits
 */
export function isValidPhoneDigits(digits) {
  if (!digits || digits.length < 10 || digits.length > 15) return false;
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length === 11 && digits[0] === '7') return true;
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * @param
 */
export async function createSubmission({ fullName, phone, message, source }: any) {
  const digits = normalizePhone(phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }
  const msg = message != null ? String(message).trim() : '';
  const src = String(source || 'contact_form').trim().slice(0, 80) || 'contact_form';
  return prisma.contactSubmission.create({
    data: {
      fullName: fullName.trim(),
      phone: digits,
      message: msg.length ? msg.slice(0, 4000) : null,
      source: src,
      status: 'NEW',
    },
  });
}

export function serializeSubmission(row) {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    message: row.message,
    source: row.source || 'contact_form',
    status: row.status,
    processedAt: row.processedAt?.toISOString?.() ?? row.processedAt ?? null,
    convertedRequestId: row.convertedRequestId,
    closedReason: row.closedReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSubmissions({ take = 100, status }: any = {}) {
  const where: any = {};
  if (status) where.status = status;
  const rows = await prisma.contactSubmission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(take, 1), 200),
  });
  return rows.map(serializeSubmission);
}

export async function updateSubmissionStatus(id, { status, closedReason }: any) {
  const row = await prisma.contactSubmission.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Обращение не найдено', 'NOT_FOUND');
  if (row.status === 'CONVERTED') {
    throw new AppError(409, 'Обращение уже конвертировано в заявку', 'CONFLICT');
  }
  const data: any = { status, processedAt: new Date() };
  if (status === 'CLOSED') {
    data.closedReason = closedReason ? String(closedReason).slice(0, 500) : null;
  }
  const updated = await prisma.contactSubmission.update({ where: { id }, data });
  return serializeSubmission(updated);
}

export async function convertSubmissionToRequest(contactId, managerId) {
  const contact = await prisma.contactSubmission.findUnique({ where: { id: contactId } });
  if (!contact) throw new AppError(404, 'Обращение не найдено', 'NOT_FOUND');
  if (contact.status === 'CONVERTED' && contact.convertedRequestId) {
    return { requestId: contact.convertedRequestId, alreadyConverted: true };
  }

  const symptoms = contact.message?.trim() || 'Обращение с формы на сайте';

  const requestId = await prisma.$transaction(async (tx) => {
    const session = await tx.consultationSession.create({
      data: {
        status: 'COMPLETED',
        progressPercent: 100,
        guestName: contact.fullName,
        guestPhone: contact.phone,
        flowState: {
          stage: 'COMPLETED',
          source: 'contact_form',
          diagnosis: {
            summary: symptoms,
            urgency: 'medium',
            confidence: null,
            analysis_available: false,
            status: 'MANUAL_REVIEW_REQUIRED',
          },
        },
      },
    });

    await tx.extractedDiagnosticData.create({
      data: {
        sessionId: session.id,
        symptoms,
      },
    });

    const sr = await tx.serviceRequest.create({
      data: {
        guestName: contact.fullName,
        guestPhone: contact.phone,
        consultationSessionId: session.id,
        status: 'NEW',
        version: 1,
        snapshotSymptoms: symptoms.slice(0, 2000),
        assignedManagerId: managerId,
      },
    });

    await tx.contactSubmission.update({
      where: { id: contactId },
      data: {
        status: 'CONVERTED',
        processedAt: new Date(),
        convertedRequestId: sr.id,
      },
    });

    return sr.id;
  });

  const full = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      client: { select: { id: true, fullName: true, phone: true, email: true } },
      consultationSession: { include: { extracted: true } },
    },
  });

  await enqueueOutboxEvent({
    eventType: 'request.created',
    entityType: 'service_request',
    entityId: requestId,
    payloadJson: { source: 'contact_form', contactId },
  });
  if (full) await notifyNewServiceRequest(full);

  return { requestId, alreadyConverted: false };
}
