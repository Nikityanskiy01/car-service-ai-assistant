function truncate(value, max) {
  if (!value || value.length <= max) return value || '';
  return `${value.slice(0, max - 3)}...`;
}

function vehicleFromConsultation(c) {
  const make = c.make ?? c.extracted?.make ?? null;
  const model = c.model ?? c.extracted?.model ?? null;
  return [make, model].filter(Boolean).join(' ');
}

function symptomsFromConsultation(c) {
  return c.symptoms ?? c.extracted?.symptoms ?? '';
}

function vehicleFromRequest(r) {
  return [r.snapshotMake, r.snapshotModel].filter(Boolean).join(' ');
}

function computeProgress(kind, requestStatus, consultationStatus, hasBooking = false) {
  if (kind === 'draft') {
    if (consultationStatus === 'COMPLETED') {
      return { stage: 'diagnosis', percent: 50, label: 'Диагностика завершена' };
    }
    return { stage: 'diagnosis', percent: 25, label: 'Сбор симптомов' };
  }

  if (requestStatus === 'COMPLETED') {
    return { stage: 'done', percent: 100, label: 'Ремонт завершён' };
  }
  if (requestStatus === 'CANCELLED') {
    return { stage: 'done', percent: 100, label: 'Обращение отменено' };
  }
  if (hasBooking || requestStatus === 'SCHEDULED') {
    return { stage: 'booking', percent: 75, label: 'Запись назначена' };
  }
  if (requestStatus === 'IN_PROGRESS') {
    return { stage: 'request', percent: 55, label: 'В работе у мастера' };
  }
  return { stage: 'request', percent: 40, label: 'Заявка принята' };
}

function getUrgencyFromSession(session) {
  if (!session?.flowState || typeof session.flowState !== 'object') return null;
  const diagnosis = session.flowState.diagnosis;
  return diagnosis?.urgency ?? null;
}

/**
 * @param {Array<import('@prisma/client').ConsultationSession & { extracted?: object | null, serviceRequest?: { id: string, status: string } | null }>} consultations
 * @param requests
 * @param {Array<import('@prisma/client').ServiceBooking & { serviceRequest?: { id: string, status: string } | null }>} bookings
 */
export function buildClientCasesFromDb(consultations, requests, bookings) {
  const cases = [];
  const linkedConsultationIds = new Set();

  const bookingByRequestId = new Map();
  for (const booking of bookings) {
    if (booking.serviceRequest?.id) {
      bookingByRequestId.set(booking.serviceRequest.id, booking);
    }
  }

  for (const request of requests) {
    const sessionId = request.consultationSessionId || request.consultationSession?.id;
    if (sessionId) linkedConsultationIds.add(sessionId);

    const booking = bookingByRequestId.get(request.id);
    const progress = computeProgress('request', request.status, undefined, Boolean(booking));
    const symptoms = request.snapshotSymptoms || '';

    cases.push({
      id: request.id,
      kind: 'request',
      title: vehicleFromRequest(request) || 'Авто не указано',
      symptoms: truncate(symptoms || 'Без описания симптомов', 80),
      status: request.status,
      requestStatus: request.status,
      progressStage: progress.stage,
      progressPercent: progress.percent,
      progressLabel: progress.label,
      lastActivityAt: request.createdAt.toISOString(),
      serviceRequestId: request.id,
      consultationSessionId: sessionId || null,
      bookingId: booking?.id || null,
      bookingPreferredAt: booking?.preferredAt?.toISOString() || null,
      urgency: getUrgencyFromSession(request.consultationSession),
      make: request.snapshotMake,
      model: request.snapshotModel,
    });
  }

  for (const consultation of consultations) {
    if (consultation.serviceRequest?.id || linkedConsultationIds.has(consultation.id)) {
      continue;
    }

    const progress = computeProgress('draft', undefined, consultation.status);
    const symptoms = symptomsFromConsultation({
      symptoms: consultation.extracted?.symptoms,
      extracted: consultation.extracted,
    });

    cases.push({
      id: consultation.id,
      kind: 'draft',
      title: vehicleFromConsultation({
        make: consultation.extracted?.make,
        model: consultation.extracted?.model,
        extracted: consultation.extracted,
      }) || 'Диагностика',
      symptoms: truncate(symptoms || 'Продолжите описание симптомов', 80),
      status: consultation.status,
      consultationStatus: consultation.status,
      progressStage: progress.stage,
      progressPercent: consultation.progressPercent ?? progress.percent,
      progressLabel: progress.label,
      lastActivityAt: consultation.createdAt.toISOString(),
      consultationSessionId: consultation.id,
      make: consultation.extracted?.make ?? null,
      model: consultation.extracted?.model ?? null,
    });
  }

  return cases.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
}

export function serializeClientCase(caseRow) {
  return {
    id: caseRow.id,
    kind: caseRow.kind,
    title: caseRow.title,
    symptoms: caseRow.symptoms,
    status: caseRow.status,
    progressLabel: caseRow.progressLabel,
    progressPercent: caseRow.progressPercent,
    progressStage: caseRow.progressStage,
    lastActivityAt: caseRow.lastActivityAt,
    urgency: caseRow.urgency ?? null,
    consultationSessionId: caseRow.consultationSessionId ?? null,
    serviceRequestId: caseRow.serviceRequestId ?? null,
  };
}
