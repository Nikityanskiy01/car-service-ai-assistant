import { managerZonePaths, type ManagerZonePaths } from '../config/managerPaths';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from './labels';
import { SLA_OVERDUE_LABEL } from './requestSla';
import type { ContactSubmission, ServiceBooking } from '../types/dashboard';
import type { ConsultationDiagnosis, ServiceRequest, ServiceRequestDetail, ServiceRequestStatus } from '../types/serviceRequest';

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

const HIDDEN_EXTRACTED_KEYS = new Set([
  'sessionId',
  'session_id',
  'id',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

export function formatMileageKm(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '');
  return `${numeric.toLocaleString('ru-RU')} км`;
}

export function formatExtractedFields(
  extracted?: Record<string, unknown> | null,
  options?: { omit?: string[] },
) {
  if (!extracted) return [];
  const omit = new Set([...(options?.omit ?? []), ...HIDDEN_EXTRACTED_KEYS]);
  return Object.entries(extracted)
    .filter(([key, value]) => {
      if (omit.has(key) || !EXTRACTED_FIELD_LABELS[key]) return false;
      if (value == null || value === '') return false;
      if (typeof value === 'object') return false;
      return true;
    })
    .map(([key, value]) => ({
      key,
      label: EXTRACTED_FIELD_LABELS[key],
      value: key === 'mileage' ? formatMileageKm(value) : String(value),
    }));
}

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

export type AttentionKind = 'sla' | 'request' | 'stale' | 'feedback' | 'booking' | 'contact';

export type AttentionItem = {
  id: string;
  title: string;
  reason: string;
  meta?: string;
  to: string;
  phone?: string;
  urgency?: string | null;
  priority: number;
  kind: AttentionKind;
  isGuest?: boolean;
  requestId?: string;
  bookingId?: string;
  version?: number;
  status?: ServiceRequest['status'];
};

const CLOSED_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export function buildAttentionItems(
  requests: ServiceRequest[],
  bookings: ServiceBooking[],
  contacts: ContactSubmission[],
  paths: ManagerZonePaths = managerZonePaths(false),
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
    const reasons: { kind: AttentionKind; reason: string; priority: number }[] = [];

    if (request.slaBreached && !CLOSED_STATUSES.has(request.status)) {
      reasons.push({ kind: 'sla', reason: SLA_OVERDUE_LABEL, priority: 95 + urgencyScore(urgency) });
    }
    if (request.status === 'NEW') {
      reasons.push({ kind: 'request', reason: 'Новое без ответа', priority: 80 + urgencyScore(urgency) });
    }
    if (request.status === 'IN_PROGRESS') {
      const hours = (now - new Date(request.createdAt).getTime()) / 3600000;
      if (hours > 4) {
        reasons.push({
          kind: 'stale',
          reason: `Без движения ${Math.floor(hours)} ч`,
          priority: 60 + urgencyScore(urgency),
        });
      }
    }
    if (requestNeedsFeedback(request)) {
      reasons.push({
        kind: 'feedback',
        reason: 'Нужна оценка ИИ',
        priority: 50 + urgencyScore(urgency),
      });
    }

    if (!reasons.length) continue;
    reasons.sort((a, b) => b.priority - a.priority);
    const top = reasons[0];
    items.push({
      id: request.id,
      title: `№${formatRequestNumber(request.id)}, ${car}`,
      reason: reasons.map((entry) => entry.reason).join(', '),
      meta: `${client}, ${symptoms}`,
      to: `${paths.requests}/${request.id}`,
      phone,
      urgency,
      priority: top.priority,
      kind: top.kind,
      isGuest: !request.clientId,
      requestId: request.id,
      version: request.version,
      status: request.status,
    });
  }

  for (const booking of bookings) {
    const diffMin = (new Date(booking.preferredAt).getTime() - now) / 60000;
    if (diffMin > 0 && diffMin < 120) {
      items.push({
        id: `booking-${booking.id}`,
        title: booking.client?.fullName || booking.guestName || 'Запись',
        reason: `Запись через ${Math.round(diffMin)} мин`,
        to: paths.calendar,
        phone: booking.client?.phone || booking.guestPhone || undefined,
        priority: 90 - Math.round(diffMin),
        kind: 'booking',
        bookingId: booking.id,
      });
    }
  }

  for (const contact of contacts.filter((c) => !c.status || c.status === 'NEW').slice(0, 5)) {
    const ageMin = (now - new Date(contact.createdAt || now).getTime()) / 60000;
    items.push({
      id: `contact-${contact.id}`,
      title: contact.fullName,
      reason: 'Пишет с сайта',
      meta: contact.message?.slice(0, 60) || contact.phone,
      to: paths.contacts,
      phone: contact.phone,
      priority: 55 - Math.min(ageMin, 30),
      kind: 'contact',
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 12);
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

export type RequestHistoryKind = 'created' | 'status' | 'message' | 'feedback' | 'crm';

export type RequestHistoryEvent = {
  id: string;
  at: string;
  kind: RequestHistoryKind;
  title: string;
  detail?: string;
};

function statusLabel(status: string | null | undefined) {
  if (!status) return 'нет';
  return SERVICE_REQUEST_STATUS_LABELS[status as ServiceRequestStatus] || status;
}

export function formatRuEventCount(count: number) {
  const n = Math.abs(count) % 100;
  const mod10 = n % 10;
  if (n > 10 && n < 20) return `${count} событий`;
  if (mod10 === 1) return `${count} событие`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} события`;
  return `${count} событий`;
}

export function buildRequestHistoryEvents(input: {
  createdAt: string;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
    actor?: { fullName?: string | null } | null;
  }>;
  messages: Array<{
    id: string;
    createdAt: string;
    author?: { fullName?: string; role?: string } | null;
  }>;
  feedbackUpdatedAt?: string | null;
  succeededJobs?: Array<{ id: string; updatedAt: string }>;
}): RequestHistoryEvent[] {
  const events: RequestHistoryEvent[] = [
    { id: 'created', at: input.createdAt, kind: 'created', title: 'Заявка создана' },
  ];

  for (const row of input.statusHistory) {
    const from = statusLabel(row.fromStatus);
    const to = statusLabel(row.toStatus);
    events.push({
      id: `status-${row.id}`,
      at: row.createdAt,
      kind: 'status',
      title: `Статус: ${to}`,
      detail:
        [row.fromStatus ? `было ${from}` : null, row.actor?.fullName].filter(Boolean).join(' · ') ||
        undefined,
    });
  }

  for (const message of input.messages) {
    const role = message.author?.role?.toUpperCase();
    const title =
      role === 'CLIENT'
        ? 'Сообщение от клиента'
        : role === 'MANAGER' || role === 'ADMINISTRATOR'
          ? 'Сообщение менеджера'
          : 'Сообщение';
    events.push({
      id: `message-${message.id}`,
      at: message.createdAt,
      kind: 'message',
      title,
      detail: message.author?.fullName || undefined,
    });
  }

  if (input.feedbackUpdatedAt) {
    events.push({
      id: 'feedback',
      at: input.feedbackUpdatedAt,
      kind: 'feedback',
      title: 'Оценка диагноза ИИ сохранена',
    });
  }

  for (const job of input.succeededJobs ?? []) {
    events.push({
      id: `crm-${job.id}`,
      at: job.updatedAt,
      kind: 'crm',
      title: 'Заявка передана в учётную систему',
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
