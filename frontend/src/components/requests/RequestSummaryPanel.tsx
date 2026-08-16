import { CalendarPlus, MessageSquare, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CriticalSafetyBanner } from '../consultation/CriticalSafetyBanner';
import { MasterChecksChecklist } from '../consultation/MasterChecksChecklist';
import { PossibleCausesList } from '../consultation/PossibleCausesList';
import { StatusBadge } from '../ui/StatusBadge';
import {
  buildDiagnosisRecommendations,
  formatExtractedFields,
  getIntegrationSummary,
  getRequestConfidence,
  getSessionDiagnosis,
} from '../../lib/managerRequestHelpers';
import { formatDateTime } from '../../lib/clientMeta';
import type { RequestIntegrationStatus } from '../../types/integration';
import type { ServiceRequestDetail } from '../../types/serviceRequest';

type Props = {
  request: ServiceRequestDetail;
  integrations: RequestIntegrationStatus | null;
  calendarPath?: string;
  phone?: string;
  onBook?: () => void;
  onOpenMessages?: () => void;
};

const URGENCY_CHIP: Record<string, { text: string; urgent?: boolean }> = {
  low: { text: 'Не срочно' },
  medium: { text: 'Средняя' },
  high: { text: 'Срочно', urgent: true },
  critical: { text: 'Критично', urgent: true },
};

const EXTRACT_CHIP_LABEL: Record<string, string> = {
  problemConditions: 'Когда',
  problem_conditions: 'Когда',
  obdCodes: 'OBD',
  obd_codes: 'OBD',
};

type Meter = {
  key: string;
  kicker?: string;
  value: string;
  urgent?: boolean;
  accent?: boolean;
};

function costLabel(amount?: number | null) {
  if (typeof amount === 'number' && amount > 0) return `от ${amount.toLocaleString('ru-RU')} ₽`;
  return null;
}

export function RequestSummaryPanel({
  request,
  integrations,
  calendarPath = '/dashboard/manager/calendar',
  phone,
  onBook,
  onOpenMessages,
}: Props) {
  const session = request.consultationSession;
  const diagnosis = getSessionDiagnosis(session);
  const extractedFields = formatExtractedFields(session?.extracted ?? null, {
    omit: ['make', 'model', 'year', 'mileage', 'symptoms'],
  });
  const recommendations = buildDiagnosisRecommendations(request);
  const email = request.client?.email || request.guestEmail || '';
  const confidence = getRequestConfidence(session);
  const urgency = diagnosis?.urgency ? URGENCY_CHIP[diagnosis.urgency.toLowerCase()] : null;
  const cost = costLabel(diagnosis?.estimated_cost_from);
  const checks = Array.isArray(diagnosis?.recommended_checks) ? diagnosis.recommended_checks : [];
  const summary = String(diagnosis?.summary || '').trim();
  const isCritical = String(diagnosis?.urgency || '').toLowerCase() === 'critical';
  const meters = [
    ...extractedFields.map((field) => ({
      key: `${field.key}-${field.value}`,
      kicker: EXTRACT_CHIP_LABEL[field.key],
      value: field.value,
    })),
    urgency ? { key: 'urgency', kicker: 'Срочность', value: urgency.text, urgent: urgency.urgent } : null,
    confidence != null ? { key: 'ai', kicker: 'ИИ', value: `${confidence}%` } : null,
    cost ? { key: 'cost', kicker: 'Оценка', value: cost, accent: true } : null,
  ].filter(Boolean) as Meter[];
  const hasPostPlan = checks.length > 0 || recommendations.length > 0;

  return (
    <div className="request-summary-layout">
      <div className="request-summary-main">
        {isCritical ? <CriticalSafetyBanner /> : null}

        <section className="request-message">
          <p>Сообщение клиента</p>
          <blockquote>{request.snapshotSymptoms || 'Симптомы не указаны'}</blockquote>
        </section>

        {meters.length ? (
          <ul className="request-meters">
            {meters.map((meter) => (
              <li
                key={meter.key}
                className={meter.urgent ? 'is-urgent' : meter.accent ? 'is-accent' : undefined}
              >
                {meter.kicker ? <small>{meter.kicker}</small> : null}
                <strong className="tnum">{meter.value}</strong>
              </li>
            ))}
          </ul>
        ) : null}

        {checks.length ? <MasterChecksChecklist checks={checks} title="На пост" hint={null} /> : null}

        <PossibleCausesList
          recommendations={recommendations}
          overallConfidence={diagnosis?.confidence}
          variant="staff"
        />

        {!hasPostPlan ? (
          <section className="request-next" aria-label="Что сделать">
            <h2>Что сделать</h2>
            <ul>
              {phone ? (
                <li>
                  <a href={`tel:${phone}`}>
                    <Phone />
                    Позвонить клиенту
                  </a>
                </li>
              ) : null}
              {onBook ? (
                <li>
                  <button type="button" onClick={onBook}>
                    <CalendarPlus />
                    Назначить запись
                  </button>
                </li>
              ) : null}
              {onOpenMessages ? (
                <li>
                  <button type="button" onClick={onOpenMessages}>
                    <MessageSquare />
                    Ответить в переписке
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {summary ? (
          <details className="request-ai-note">
            <summary>Почему так</summary>
            <p>{summary}</p>
          </details>
        ) : null}
      </div>

      <aside className="request-summary-side">
        {request.bookings?.length ? (
          <div className="request-booking-list">
            {request.bookings.map((booking) => (
              <article key={booking.id} className="request-booking-tile">
                <header>
                  <span>Запись</span>
                  <StatusBadge status={booking.status} />
                </header>
                <p className="request-booking-when tnum">{formatDateTime(booking.preferredAt)}</p>
                <Link to={calendarPath}>Календарь</Link>
              </article>
            ))}
          </div>
        ) : (
          <article className="request-booking-tile is-empty">
            <header>
              <span>Запись</span>
            </header>
            <p className="request-booking-when">На пост ещё не поставили</p>
            {onBook ? (
              <button type="button" onClick={onBook}>
                Назначить
              </button>
            ) : (
              <Link to={calendarPath}>Календарь</Link>
            )}
          </article>
        )}

        <dl className="request-side-facts">
          {phone ? (
            <div>
              <dt>Телефон</dt>
              <dd>
                <a href={`tel:${phone}`}>{phone}</a>
              </dd>
            </div>
          ) : null}
          {email ? (
            <div>
              <dt>Почта</dt>
              <dd className="request-summary-email">{email}</dd>
            </div>
          ) : null}
          <div>
            <dt>Клиент</dt>
            <dd>{request.clientId ? 'Зарегистрирован' : 'Гость'}</dd>
          </div>
          <div>
            <dt>Учёт</dt>
            <dd>{getIntegrationSummary(integrations)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
