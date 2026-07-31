import {
  CalendarCheck2,
  CircleCheck,
  MessageSquareText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { ClientCase } from '../../features/client-cases/types';
import { isVisitConfirmed, visitTimelineDetail } from '../../features/client-cases/visitStatusCopy';

type TimelineStep = {
  id: string;
  label: string;
  detail?: string;
  state: 'done' | 'current' | 'upcoming';
  when?: string;
  icon: LucideIcon;
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

export function buildCaseJourneySteps({
  clientCase,
  requestCreatedAt,
  bookingPreferredAt,
  bookingStatus,
}: {
  clientCase: ClientCase;
  requestCreatedAt?: string;
  bookingPreferredAt?: string;
  bookingStatus?: string;
}): TimelineStep[] {
  if (clientCase.kind === 'draft') {
    const diagnosisDone = clientCase.consultationStatus === 'COMPLETED';
    return [
      {
        id: 'diagnosis',
        label: 'Диагностика',
        detail: diagnosisDone ? 'Анализ готов — можно создать обращение' : 'Продолжите диалог в чате',
        state: diagnosisDone ? 'done' : 'current',
        icon: Sparkles,
      },
      {
        id: 'service',
        label: 'Ответ сервиса',
        detail: 'Появится после создания обращения',
        state: 'upcoming',
        icon: MessageSquareText,
      },
      {
        id: 'visit',
        label: 'Визит',
        detail: 'Ещё не назначен',
        state: 'upcoming',
        icon: CalendarCheck2,
      },
      {
        id: 'done',
        label: 'Готово',
        detail: 'После завершения работ',
        state: 'upcoming',
        icon: CircleCheck,
      },
    ];
  }

  const status = clientCase.requestStatus || 'NEW';
  const hasVisit = Boolean(clientCase.bookingId || bookingPreferredAt || status === 'SCHEDULED');
  const closed = status === 'COMPLETED' || status === 'CANCELLED';
  const visitConfirmed = isVisitConfirmed(bookingStatus) || status === 'SCHEDULED';
  const whenLabel = formatWhen(bookingPreferredAt);

  let serviceState: TimelineStep['state'] = 'current';
  let serviceDetail = 'Менеджер ещё не взял в работу';
  if (closed) {
    serviceState = 'done';
    serviceDetail = status === 'CANCELLED' ? 'Обращение закрыто' : 'Работы завершены';
  } else if (status === 'IN_PROGRESS' || visitConfirmed) {
    serviceState = hasVisit && !closed ? 'done' : 'current';
    serviceDetail =
      status === 'IN_PROGRESS' ? 'Сервис работает по обращению' : 'Сервис подтвердил визит';
  } else if (hasVisit) {
    // PENDING booking — сервис ещё не подтвердил слот
    serviceState = 'current';
    serviceDetail = 'Ждём ответа по визиту';
  }

  let visitState: TimelineStep['state'] = 'upcoming';
  let visitDetail = 'Ещё не назначен';
  if (closed && !hasVisit) {
    visitState = 'done';
    visitDetail = 'Не потребовался';
  } else if (hasVisit) {
    visitDetail = visitTimelineDetail(bookingStatus || (status === 'SCHEDULED' ? 'CONFIRMED' : 'PENDING'), whenLabel);
    if (closed) visitState = 'done';
    else if (visitConfirmed) visitState = 'current';
    else visitState = 'current';
  }

  // Если визит ещё только запрошен — фокус на нём, «ответ сервиса» не помечаем done
  if (hasVisit && !visitConfirmed && !closed && status === 'NEW') {
    serviceState = 'current';
    serviceDetail = 'Ждём подтверждения менеджера';
  }

  return [
    {
      id: 'diagnosis',
      label: 'Диагностика',
      detail: 'ИИ-разбор передан в сервис',
      state: 'done',
      when: requestCreatedAt,
      icon: Sparkles,
    },
    {
      id: 'service',
      label: 'Ответ сервиса',
      detail: serviceDetail,
      state: serviceState,
      icon: MessageSquareText,
    },
    {
      id: 'visit',
      label: 'Визит',
      detail: visitDetail,
      state: visitState,
      icon: CalendarCheck2,
    },
    {
      id: 'done',
      label: 'Готово',
      detail:
        status === 'COMPLETED'
          ? 'Работы завершены'
          : status === 'CANCELLED'
            ? 'Обращение закрыто'
            : 'После завершения работ',
      state: closed ? 'done' : 'upcoming',
      icon: CircleCheck,
    },
  ];
}

export function CaseTimeline({
  clientCase,
  requestCreatedAt,
  bookingPreferredAt,
  bookingStatus,
}: {
  clientCase: ClientCase;
  requestCreatedAt?: string;
  bookingPreferredAt?: string;
  bookingStatus?: string;
}) {
  const steps = buildCaseJourneySteps({
    clientCase,
    requestCreatedAt,
    bookingPreferredAt,
    bookingStatus,
  });

  return (
    <ol className="case-timeline" aria-label="Ход обращения">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.id} className={`case-timeline-step is-${step.state}`}>
            <div className="case-timeline-rail" aria-hidden>
              <span className="case-timeline-marker">
                <Icon size={14} strokeWidth={2.4} />
              </span>
              {index < steps.length - 1 ? <span className="case-timeline-connector" /> : null}
            </div>
            <div className="case-timeline-content">
              <strong>{step.label}</strong>
              {step.detail ? <span className="muted-text">{step.detail}</span> : null}
              {step.when ? <time className="case-timeline-time">{formatWhen(step.when)}</time> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
