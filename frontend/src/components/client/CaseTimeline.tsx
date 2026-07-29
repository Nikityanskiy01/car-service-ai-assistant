import type { ClientCase } from '../../features/client-cases/types';
import { clientRequestStatusLabel } from '../../lib/clientStatusLabels';

type TimelineStep = {
  id: string;
  label: string;
  detail?: string;
  state: 'done' | 'current' | 'upcoming';
};

function formatWhen(value?: string) {
  if (!value) return undefined;
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CaseTimeline({
  clientCase,
  requestCreatedAt,
  bookingPreferredAt,
}: {
  clientCase: ClientCase;
  requestCreatedAt?: string;
  bookingPreferredAt?: string;
}) {
  const steps: TimelineStep[] = [];

  if (clientCase.kind === 'draft') {
    steps.push({
      id: 'diagnosis',
      label: 'ИИ-диагностика',
      detail:
        clientCase.consultationStatus === 'COMPLETED'
          ? 'Анализ завершён — можно создать заявку'
          : 'Продолжите диалог в чате',
      state: clientCase.consultationStatus === 'COMPLETED' ? 'done' : 'current',
    });
    steps.push({
      id: 'request',
      label: 'Заявка мастеру',
      detail: 'Создайте заявку из результата диагностики',
      state: 'upcoming',
    });
    steps.push({ id: 'booking', label: 'Запись на визит', state: 'upcoming' });
    steps.push({ id: 'done', label: 'Ремонт', state: 'upcoming' });
  } else {
    steps.push({
      id: 'diagnosis',
      label: 'ИИ-диагностика',
      detail: 'Данные переданы менеджеру',
      state: 'done',
    });

    const requestState =
      clientCase.requestStatus === 'NEW'
        ? 'current'
        : clientCase.requestStatus === 'CANCELLED' || clientCase.requestStatus === 'COMPLETED'
          ? 'done'
          : 'done';

    steps.push({
      id: 'request',
      label: 'Заявка',
      detail: clientRequestStatusLabel(clientCase.requestStatus || 'NEW'),
      state: requestState,
    });

    const bookingState =
      clientCase.bookingId || clientCase.requestStatus === 'SCHEDULED'
        ? clientCase.requestStatus === 'COMPLETED'
          ? 'done'
          : 'current'
        : clientCase.requestStatus === 'COMPLETED'
          ? 'done'
          : 'upcoming';

    steps.push({
      id: 'booking',
      label: 'Запись',
      detail: bookingPreferredAt ? `Визит: ${formatWhen(bookingPreferredAt)}` : 'Ещё не назначена',
      state: bookingState,
    });

    steps.push({
      id: 'done',
      label: 'Ремонт',
      detail:
        clientCase.requestStatus === 'COMPLETED'
          ? 'Работы завершены'
          : clientCase.requestStatus === 'CANCELLED'
            ? 'Обращение закрыто'
            : 'Ожидается завершение',
      state: clientCase.requestStatus === 'COMPLETED' ? 'done' : 'upcoming',
    });
  }

  return (
    <ol className="case-timeline" aria-label="Ход обращения">
      {steps.map((step) => (
        <li key={step.id} className={`case-timeline-step is-${step.state}`}>
          <span className="case-timeline-marker" aria-hidden />
          <div className="case-timeline-content">
            <strong>{step.label}</strong>
            {step.detail ? <span className="muted-text">{step.detail}</span> : null}
            {step.id === 'request' && requestCreatedAt ? (
              <time className="case-timeline-time">{formatWhen(requestCreatedAt)}</time>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
