import type {
  BookingCaseInput,
  ClientCase,
  ClientCaseStage,
  ClientCaseTab,
  ConsultationCaseInput,
  RequestCaseInput,
} from './types';

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function vehicleFromConsultation(c: ConsultationCaseInput) {
  const make = c.make ?? c.extracted?.make ?? null;
  const model = c.model ?? c.extracted?.model ?? null;
  return [make, model].filter(Boolean).join(' ');
}

function symptomsFromConsultation(c: ConsultationCaseInput) {
  return c.symptoms ?? c.extracted?.symptoms ?? '';
}

function vehicleFromRequest(r: RequestCaseInput) {
  return [r.snapshotMake, r.snapshotModel].filter(Boolean).join(' ');
}

function computeProgress(
  kind: 'request' | 'draft',
  requestStatus?: string,
  consultationStatus?: string,
  hasBooking?: boolean,
): { stage: ClientCaseStage; percent: number; label: string } {
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

export function buildClientCases(
  consultations: ConsultationCaseInput[],
  requests: RequestCaseInput[],
  bookings: BookingCaseInput[],
): ClientCase[] {
  const cases: ClientCase[] = [];
  const linkedConsultationIds = new Set<string>();

  const bookingByRequestId = new Map<string, BookingCaseInput>();
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
      lastActivityAt: request.createdAt,
      serviceRequestId: request.id,
      consultationSessionId: sessionId,
      bookingId: booking?.id,
      bookingPreferredAt: booking?.preferredAt,
      urgency: request.consultationSession?.diagnosis?.urgency ?? null,
      make: request.snapshotMake,
      model: request.snapshotModel,
    });
  }

  for (const consultation of consultations) {
    if (consultation.serviceRequest?.id || linkedConsultationIds.has(consultation.id)) {
      continue;
    }

    const progress = computeProgress('draft', undefined, consultation.status);
    const symptoms = symptomsFromConsultation(consultation);

    cases.push({
      id: consultation.id,
      kind: 'draft',
      title: vehicleFromConsultation(consultation) || 'Диагностика',
      symptoms: truncate(symptoms || 'Продолжите описание симптомов', 80),
      status: consultation.status,
      consultationStatus: consultation.status,
      progressStage: progress.stage,
      progressPercent: consultation.progressPercent ?? progress.percent,
      progressLabel: progress.label,
      lastActivityAt: consultation.createdAt,
      consultationSessionId: consultation.id,
      make: consultation.make ?? consultation.extracted?.make,
      model: consultation.model ?? consultation.extracted?.model,
    });
  }

  return cases.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
}

export function filterCasesByTab(cases: ClientCase[], tab: ClientCaseTab): ClientCase[] {
  if (tab === 'drafts') {
    return cases.filter((c) => c.kind === 'draft');
  }
  if (tab === 'archive') {
    return cases.filter(
      (c) =>
        c.kind === 'request' &&
        (c.requestStatus === 'COMPLETED' || c.requestStatus === 'CANCELLED'),
    );
  }
  return cases.filter(
    (c) =>
      c.kind === 'request' &&
      c.requestStatus !== 'COMPLETED' &&
      c.requestStatus !== 'CANCELLED',
  );
}

export function filterCasesByQuery(cases: ClientCase[], query: string): ClientCase[] {
  const q = query.trim().toLowerCase();
  if (!q) return cases;
  return cases.filter((item) => {
    const haystack = [item.title, item.symptoms, item.make, item.model].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function parseClientCaseTab(value: string | null): ClientCaseTab {
  if (value === 'archive' || value === 'drafts') return value;
  return 'active';
}

export function parseClientCaseDetailTab(value: string | null): import('./types').ClientCaseDetailTab {
  if (value === 'diagnosis' || value === 'messages' || value === 'booking') return value;
  return 'progress';
}
