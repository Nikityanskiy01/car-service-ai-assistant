import { Link } from 'react-router-dom';
import { DiagnosticSummary } from '../consultation/DiagnosticSummary';
import { UrgencyBadge } from '../consultation/UrgencyBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { QuickFeedbackButtons } from './QuickFeedbackButtons';
import {
  buildDiagnosisRecommendations,
  formatExtractedFields,
  getIntegrationSummary,
  getRequestConfidence,
  getSessionDiagnosis,
} from '../../lib/managerRequestHelpers';
import type { RequestIntegrationStatus } from '../../types/integration';
import type { ServiceRequestDetail } from '../../types/serviceRequest';

type Props = {
  request: ServiceRequestDetail;
  integrations: RequestIntegrationStatus | null;
  onFeedbackSaved: (feedback: NonNullable<ServiceRequestDetail['consultationSession']>['feedback']) => void;
};

export function RequestSummaryPanel({ request, integrations, onFeedbackSaved }: Props) {
  const session = request.consultationSession;
  const diagnosis = getSessionDiagnosis(session);
  const confidence = getRequestConfidence(session);
  const extractedFields = formatExtractedFields(session?.extracted ?? null);
  const recommendations = buildDiagnosisRecommendations(request);
  const owner = request.client?.fullName || request.guestName || 'Гость';
  const phone = request.client?.phone || request.guestPhone || '—';
  const email = request.client?.email || request.guestEmail || '—';
  const car = `${request.snapshotMake || ''} ${request.snapshotModel || ''}`.trim() || 'Не указан';

  return (
    <div className="request-summary-layout">
      <div className="request-summary-main stack">
        <CardSection title="Проблема клиента">
          <p>{request.snapshotSymptoms || 'Симптомы не указаны'}</p>
        </CardSection>

        {extractedFields.length ? (
          <CardSection title="Что понял ИИ">
            <dl className="detail-dl extracted-fields">
              {extractedFields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </CardSection>
        ) : null}

        <CardSection title="Предварительный анализ">
          {diagnosis || recommendations.length ? (
            <DiagnosticSummary
              diagnosis={diagnosis || undefined}
              recommendations={recommendations}
            />
          ) : (
            <p className="muted">ИИ-анализ ещё не готов или требует уточнений.</p>
          )}
        </CardSection>
      </div>

      <aside className="request-summary-side stack">
        <CardSection title="Контакты">
          <dl className="detail-dl">
            <div>
              <dt>Клиент</dt>
              <dd>{owner}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>
                {phone !== '—' ? (
                  <a href={`tel:${phone}`} className="contact-link">
                    {phone}
                  </a>
                ) : (
                  phone
                )}
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Тип</dt>
              <dd>{request.clientId ? 'Зарегистрирован' : 'Гость'}</dd>
            </div>
          </dl>
        </CardSection>

        <CardSection title="Автомобиль">
          <p>
            <strong>{car}</strong>
          </p>
          {session?.extracted?.year ? <p className="muted">Год: {String(session.extracted.year)}</p> : null}
          {session?.extracted?.mileage ? (
            <p className="muted">Пробег: {String(session.extracted.mileage)} км</p>
          ) : null}
        </CardSection>

        <CardSection title="ИИ-сводка">
          <div className="ai-mini-stats">
            <UrgencyBadge urgency={diagnosis?.urgency} />
            {confidence != null ? <span className="ai-confidence-pill">Уверенность: {confidence}%</span> : null}
          </div>
        </CardSection>

        {request.bookings?.length ? (
          <CardSection title="Связанная запись">
            <ul className="simple-list">
              {request.bookings.map((booking) => (
                <li key={booking.id}>
                  <StatusBadge status={booking.status} />
                  <span>{new Date(booking.preferredAt).toLocaleString('ru-RU')}</span>
                  <Link to="/dashboard/manager/calendar" className="muted">
                    Календарь →
                  </Link>
                </li>
              ))}
            </ul>
          </CardSection>
        ) : null}

        <CardSection title="Учётная система">
          <p>{getIntegrationSummary(integrations)}</p>
          <p className="muted">Подробности — во вкладке «История и CRM».</p>
        </CardSection>

        <QuickFeedbackButtons
          requestId={request.id}
          initial={session?.feedback}
          onSaved={(feedback) => onFeedbackSaved(feedback)}
        />
      </aside>
    </div>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="summary-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
