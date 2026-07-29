import type { ContactSubmission, ServiceBooking } from '../types/dashboard';
import type { ConsultationDiagnosis, ServiceRequest, ServiceRequestDetail } from '../types/serviceRequest';

const EXTRACTED_FIELD_LABELS: Record<string, string> = {
  make: 'Марка',
  model: 'Модель',
  year: 'Год',
  mileage: 'Пробег',
  symptoms: 'Симптомы',
  problemConditions: 'Условия проявления',
  problem_conditions: 'Условия проявления',
  obdCodes: 'Коды OBD-II',
  obd_codes: 'Коды OBD-II',
};

type SessionLike = {
  diagnosis?: ConsultationDiagnosis | null;
  flowState?: unknown;
  extracted?: Record<string, unknown> | null;
  feedback?: { id?: string; verdict?: string } | null;
  confidencePercent?: number | null;
};

export function getSessionDiagnosis(session?: SessionLike | null): ConsultationDiagnosis | null {
  if (!session) return null;
  if (session.diagnosis) return session.diagnosis;
  const flowState = session.flowState as { diagnosis?: ConsultationDiagnosis } | null | undefined;
  return flowState?.diagnosis ?? null;
}

export function getRequestConfidence(session?: SessionLike | null): number | null {
  const diagnosis = getSessionDiagnosis(session);
  if (typeof diagnosis?.confidence === 'number') {
    return Math.round(diagnosis.confidence * 100);
  }
  if (typeof session?.confidencePercent === 'number') {
    return session.confidencePercent;
  }
  return null;
}

export function getRequestUrgency(session?: SessionLike | null): string | null {
  const diagnosis = getSessionDiagnosis(session);
  return diagnosis?.urgency ?? null;
}

export function formatExtractedFields(extracted?: Record<string, unknown> | null) {
  if (!extracted) return [];
  return Object.entries(extracted)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => ({
      key,
      label: EXTRACTED_FIELD_LABELS[key] || key,
      value: key === 'mileage' ? `${value} км` : String(value),
    }));
}

export function formatRelativeTime(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export function requestNeedsFeedback(request: ServiceRequest, minHours = 0) {
  if (!['IN_PROGRESS', 'SCHEDULED', 'COMPLETED'].includes(request.status)) return false;
  const session = request.consultationSession;
  if (!session || session.feedback?.id) return false;
  if (minHours > 0) {
    const hours = (Date.now() - new Date(request.createdAt).getTime()) / 3600000;
    if (hours < minHours) return false;
  }
  return true;
}

export function urgencyScore(urgency?: string | null) {
  const key = String(urgency || '').toLowerCase();
  if (key === 'critical') return 100;
  if (key === 'high') return 70;
  if (key === 'medium') return 40;
  return 10;
}

export type AttentionItem = {
  id: string;
  title: string;
  reason: string;
  meta?: string;
  to: string;
  phone?: string;
  urgency?: string | null;
  priority: number;
  isGuest?: boolean;
  requestId?: string;
  bookingId?: string;
  version?: number;
};

export function buildAttentionItems(
  requests: ServiceRequest[],
  bookings: ServiceBooking[],
  contacts: ContactSubmission[],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = Date.now();

  for (const request of requests) {
    const session = request.consultationSession;
    const diagnosis = getSessionDiagnosis(session);
    const urgency = diagnosis?.urgency ?? null;
    const car =
      `${request.snapshotMake || ''} ${request.snapshotModel || ''}`.trim() || 'Авто не указано';
    const client = request.client?.fullName || request.guestName || 'Гость';
    const phone = request.client?.phone || request.guestPhone || undefined;
    const symptoms = request.snapshotSymptoms?.slice(0, 48) || 'без описания';
    const base = {
      title: `№${request.id.slice(0, 8).toUpperCase()} · ${car}`,
      meta: `${client} · ${symptoms}`,
      to: `/dashboard/manager/requests/${request.id}`,
      phone,
      urgency,
      isGuest: !request.clientId,
      requestId: request.id,
      version: request.version,
    };

    if (request.status === 'NEW') {
      items.push({
        ...base,
        id: request.id,
        reason: 'Новое обращение без ответа',
        priority: 80 + urgencyScore(urgency),
      });
    }

    if (request.status === 'IN_PROGRESS') {
      const hours = (now - new Date(request.createdAt).getTime()) / 3600000;
      if (hours > 4) {
        items.push({
          ...base,
          id: `${request.id}-stale`,
          reason: `Без изменения статуса ${Math.floor(hours)} ч`,
          priority: 60 + urgencyScore(urgency),
        });
      }
    }

    if (requestNeedsFeedback(request)) {
      items.push({
        ...base,
        id: `${request.id}-feedback`,
        reason: 'Нужна оценка диагноза ИИ',
        priority: 50 + urgencyScore(urgency),
      });
    }
  }

  for (const booking of bookings) {
    const diffMin = (new Date(booking.preferredAt).getTime() - now) / 60000;
    if (diffMin > 0 && diffMin < 120) {
      items.push({
        id: `booking-${booking.id}`,
        title: booking.client?.fullName || booking.guestName || 'Запись',
        reason: `Визит через ${Math.round(diffMin)} мин`,
        to: '/dashboard/manager/calendar',
        phone: booking.client?.phone || booking.guestPhone || undefined,
        priority: 90 - Math.round(diffMin),
        bookingId: booking.id,
      });
    }
  }

  for (const contact of contacts.filter((c) => !c.status || c.status === 'NEW').slice(0, 5)) {
    const ageMin = (now - new Date(contact.createdAt || now).getTime()) / 60000;
    items.push({
      id: `contact-${contact.id}`,
      title: contact.fullName,
      reason: 'Новое обращение с сайта',
      meta: contact.message?.slice(0, 60) || contact.phone,
      to: '/dashboard/manager/contacts',
      phone: contact.phone,
      priority: 55 - Math.min(ageMin, 30),
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 10);
}

export function buildDiagnosisRecommendations(request: ServiceRequestDetail) {
  const diagnosis = getSessionDiagnosis(request.consultationSession);
  const recommendation = request.consultationSession?.recommendations?.[0];

  if (Array.isArray(diagnosis?.probable_causes) && diagnosis.probable_causes.length) {
    return diagnosis.probable_causes.map((title, index) => ({
      title,
      probabilityPercent:
        index === 0 && typeof diagnosis?.confidence === 'number'
          ? Math.round(diagnosis.confidence * 100)
          : undefined,
    }));
  }

  if (recommendation?.title) {
    return [
      {
        title: recommendation.title,
        probabilityPercent: recommendation.probabilityPercent,
      },
    ];
  }

  return [];
}

export function getIntegrationSummary(
  integrations: { links?: unknown[]; jobs?: Array<{ status: string }> } | null,
) {
  if (!integrations?.links?.length) {
    const failed = integrations?.jobs?.some((job) =>
      ['FAILED', 'RETRYING', 'DEAD_LETTER'].includes(job.status),
    );
    return failed ? 'Ошибка синхронизации' : 'Не передано';
  }
  return 'Синхронизировано';
}
