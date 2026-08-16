import { CalendarPlus, MessageSquare, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CriticalSafetyBanner } from '../consultation/CriticalSafetyBanner';
import { StatusBadge } from '../ui/StatusBadge';
import {
  buildDiagnosisRecommendations,
  formatExtractedFields,
  getIntegrationSummary,
  getRequestConfidence,
  getSessionDiagnosis,
} from '../../lib/managerRequestHelpers';
import { formatDateTime } from '../../lib/clientMeta';
import { formatUrgencyLabel, isUrgentLevel } from '../../lib/labels';
import { formatPhoneDisplay } from '../../lib/phone';
import type { RequestIntegrationStatus } from '../../types/integration';
import type { ServiceRequestDetail } from '../../types/serviceRequest';

type Props = {
  request: ServiceRequestDetail;
  integrations: RequestIntegrationStatus | null;
  calendarPath?: string;
  phone?: string;
  onBook?: () => void;
  onOpenMessages?: () => void;
  onOpenConsultation?: () => void;
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

function topCauseLabel(request: ServiceRequestDetail) {
  const item = buildDiagnosisRecommendations(request)[0];
  if (!item) return null;
  const title = String(item.title || '').trim();
  if (!title) return null;
  const name = title.split(/\s+[—–-]\s+/)[0]?.trim() || title;
  const percent = typeof item.probabilityPercent === 'number' ? Math.round(item.probabilityPercent) : null;
  return { name, percent };
}

export function RequestSummaryPanel({
  request,
  integrations,
  calendarPath = '/dashboard/manager/calendar',
  phone,
  onBook,
  onOpenMessages,
  onOpenConsultation,
}: Props) {
  const session = request.consultationSession;
  const diagnosis = getSessionDiagnosis(session);
  const extractedFields = formatExtractedFields(session?.extracted ?? null, {
    omit: ['make', 'model', 'year', 'mileage', 'symptoms'],
  });
  const email = request.client?.email || request.guestEmail || '';
  const confidence = getRequestConfidence(session);
  const urgencyLabel = formatUrgencyLabel(diagnosis?.urgency);
  const cost = costLabel(diagnosis?.estimated_cost_from);
  const isCritical = String(diagnosis?.urgency || '').toLowerCase() === 'critical';
  const accounting = getIntegrationSummary(integrations);
  const accountingWarn = accounting.startsWith('Ошибка');
  const hypothesis = topCauseLabel(request);
  const meters = [
    ...extractedFields.map((field) => ({
      key: `${field.key}-${field.value}`,
      kicker: EXTRACT_CHIP_LABEL[field.key],
      value: field.value,
    })),
    urgencyLabel
      ? {
          key: 'urgency',
          kicker: 'Срочность',
          value: urgencyLabel,
          urgent: isUrgentLevel(diagnosis?.urgency),
        }
      : null,
    confidence != null ? { key: 'ai', kicker: 'ИИ', value: `${confidence}%` } : null,
    cost ? { key: 'cost', kicker: 'Ориентир', value: cost, accent: true } : null,
  ].filter(Boolean) as Meter[];

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

        {hypothesis ? (
          <p className="request-diag-teaser">
            <span>
              Гипотеза ИИ: {hypothesis.name}
              {hypothesis.percent != null ? (
                <>
                  , <strong className="tnum">{hypothesis.percent}%</strong>
                </>
              ) : null}
            </span>
            {onOpenConsultation ? (
              <button type="button" className="request-inline-link" onClick={onOpenConsultation}>
                Открыть диалог
              </button>
            ) : null}
          </p>
        ) : null}

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
                {booking.status === 'PENDING' ? (
                  <p className="request-booking-warn">
                    Клиент уже видит слот. Подтвердите только после согласования.
                  </p>
                ) : null}
                <Link to={calendarPath}>Календарь</Link>
              </article>
            ))}
          </div>
        ) : (
          <article className="request-booking-tile is-empty">
            <header>
              <span>Запись</span>
            </header>
            <p className="request-booking-when">В сервис ещё не записали</p>
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
                <a href={`tel:${phone}`}>{formatPhoneDisplay(phone)}</a>
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
            <dd className={accountingWarn ? 'is-warn' : undefined}>{accounting}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
