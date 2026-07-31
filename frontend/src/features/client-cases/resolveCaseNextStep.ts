import type { ServiceRequestStatus } from '../../types/serviceRequest';
import { isVisitConfirmed, resolveVisitConfirmLevel } from './visitStatusCopy';

export type CaseNextStepActionId =
  | 'continue_diagnosis'
  | 'book_visit'
  | 'open_visit'
  | 'write_message'
  | 'download_pdf'
  | 'back_to_list';

export type CaseNextStepTone = 'draft' | 'waiting' | 'active' | 'visit' | 'done' | 'cancelled';

export type CaseNextStepIcon =
  | 'sparkles'
  | 'hourglass'
  | 'wrench'
  | 'calendar'
  | 'check'
  | 'off';

export type CaseNextStepCta = {
  label: string;
  action: CaseNextStepActionId;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export type CaseNextStepModel = {
  tone: CaseNextStepTone;
  icon: CaseNextStepIcon;
  nowLabel: string;
  yourStepLabel?: string;
  primary: CaseNextStepCta;
  secondary?: CaseNextStepCta;
};

type ResolveInput = {
  isDraft: boolean;
  consultationStatus?: string | null;
  requestStatus?: ServiceRequestStatus | null;
  requestId?: string | null;
  bookingId?: string | null;
  bookingPreferredAt?: string | null;
  bookingStatus?: string | null;
};

function formatVisitWhen(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function resolveCaseNextStep(input: ResolveInput): CaseNextStepModel {
  if (input.isDraft) {
    const ready = input.consultationStatus === 'COMPLETED';
    return {
      tone: 'draft',
      icon: 'sparkles',
      nowLabel: ready ? 'Диагностика завершена' : 'Диагностика ещё не завершена',
      yourStepLabel: ready
        ? 'Создайте обращение из результата — менеджер увидит его в кабинете'
        : 'Продолжите диалог в чате',
      primary: { label: 'Продолжить диагностику', action: 'continue_diagnosis', variant: 'primary' },
    };
  }

  const status = input.requestStatus ?? 'NEW';
  const hasVisit = Boolean(input.bookingId || input.bookingPreferredAt || status === 'SCHEDULED');
  const visitLevel = resolveVisitConfirmLevel(input.bookingStatus);
  const confirmed =
    isVisitConfirmed(input.bookingStatus) || status === 'SCHEDULED' || visitLevel === 'arrived';
  const when = input.bookingPreferredAt ? formatVisitWhen(input.bookingPreferredAt) : null;

  if (status === 'COMPLETED') {
    return {
      tone: 'done',
      icon: 'check',
      nowLabel: 'Работы завершены',
      yourStepLabel: 'Обращение в архиве — отчёт можно скачать',
      primary: input.requestId
        ? { label: 'Скачать PDF', action: 'download_pdf', variant: 'primary' }
        : { label: 'К списку обращений', action: 'back_to_list', variant: 'secondary' },
      secondary: { label: 'К списку', action: 'back_to_list', variant: 'ghost' },
    };
  }

  if (status === 'CANCELLED') {
    return {
      tone: 'cancelled',
      icon: 'off',
      nowLabel: 'Обращение закрыто',
      yourStepLabel: 'Новых действий не требуется',
      primary: { label: 'К списку обращений', action: 'back_to_list', variant: 'secondary' },
    };
  }

  if (confirmed && hasVisit) {
    return {
      tone: 'visit',
      icon: 'calendar',
      nowLabel: when ? `Визит подтверждён на ${when}` : 'Визит подтверждён',
      yourStepLabel: 'Приезжайте в сервис в указанное время',
      primary: { label: 'Открыть визит', action: 'open_visit', variant: 'primary' },
      secondary: { label: 'Написать', action: 'write_message', variant: 'secondary' },
    };
  }

  if (hasVisit) {
    return {
      tone: 'waiting',
      icon: 'calendar',
      nowLabel: when ? `Визит запрошен на ${when}` : 'Визит запрошен',
      yourStepLabel: 'Ждём подтверждения времени менеджером',
      primary: { label: 'Открыть визит', action: 'open_visit', variant: 'primary' },
      secondary: { label: 'Написать', action: 'write_message', variant: 'secondary' },
    };
  }

  if (status === 'IN_PROGRESS') {
    return {
      tone: 'active',
      icon: 'wrench',
      nowLabel: 'Сервис работает по обращению',
      yourStepLabel: 'Запишитесь на визит или уточните детали у менеджера',
      primary: { label: 'Записаться на визит', action: 'book_visit', variant: 'primary' },
      secondary: { label: 'Написать', action: 'write_message', variant: 'secondary' },
    };
  }

  return {
    tone: 'waiting',
    icon: 'hourglass',
    nowLabel: 'Менеджер ещё не взял обращение в работу',
    yourStepLabel: 'Можно записаться на визит или написать вопрос',
    primary: { label: 'Записаться на визит', action: 'book_visit', variant: 'primary' },
    secondary: { label: 'Написать', action: 'write_message', variant: 'secondary' },
  };
}
