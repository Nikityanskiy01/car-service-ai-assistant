export type ClientCaseSummaryItem = {
  id: string;
  kind: 'request' | 'draft';
  title: string;
  symptoms: string;
  status: string;
  progressLabel: string;
  progressPercent: number;
  progressStage: 'diagnosis' | 'request' | 'booking' | 'done';
  lastActivityAt: string;
  urgency?: string | null;
  consultationSessionId?: string | null;
  serviceRequestId?: string | null;
  unreadCount?: number;
};

export type ClientUnreadThread = {
  requestId: string;
  title: string;
  symptoms: string;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAt: string;
};

export type ClientDashboardSummary = {
  profile: { fullName: string; phone: string | null };
  activeCasesCount: number;
  unreadMessagesCount: number;
  unreadThreads: ClientUnreadThread[];
  hasAnyHistory: boolean;
  nextBooking: { id: string; preferredAt: string; status: string } | null;
  draftConsultation: {
    id: string;
    make?: string | null;
    model?: string | null;
    symptom?: string | null;
    status?: string | null;
  } | null;
  recentActiveCases: ClientCaseSummaryItem[];
};

export type ClientHeroState = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  ctaSessionId?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  isNewcomer?: boolean;
};

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function formatBookingDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function resolveClientHero(summary: ClientDashboardSummary): ClientHeroState {
  const draft = summary.draftConsultation;
  if (draft?.id) {
    const vehicle = [draft.make, draft.model].filter(Boolean).join(' ');
    const symptom = draft.symptom ? truncate(draft.symptom, 48) : '';
    return {
      title: vehicle
        ? `Продолжить: ${vehicle}${symptom ? ` — ${symptom}` : ''}`
        : 'Продолжить диагностику',
      description: 'Диалог не завершён — можно вернуться в чат и уточнить детали.',
      ctaLabel: 'Продолжить',
      ctaTo: '/consult',
      ctaSessionId: draft.id,
      secondaryLabel: 'Все обращения',
      secondaryTo: '/dashboard/client/cases?tab=drafts',
    };
  }

  const primaryCase = summary.recentActiveCases[0];
  if (primaryCase?.status === 'NEW') {
    return {
      title: 'Менеджер рассматривает ваше обращение',
      description: `${primaryCase.title} — ${truncate(primaryCase.symptoms, 64)}`,
      ctaLabel: 'Открыть переписку',
      ctaTo: `/dashboard/client/cases/${primaryCase.id}?tab=messages`,
      secondaryLabel: 'Все обращения',
      secondaryTo: '/dashboard/client/cases',
    };
  }

  if (summary.nextBooking) {
    return {
      title: `Запись: ${formatBookingDate(summary.nextBooking.preferredAt)}`,
      description:
        summary.nextBooking.status === 'CONFIRMED'
          ? 'Запись подтверждена — ждём вас в сервисе.'
          : 'Запись ожидает подтверждения менеджером.',
      ctaLabel: 'Детали записи',
      ctaTo: `/dashboard/client/bookings/${summary.nextBooking.id}`,
      secondaryLabel: 'Мои обращения',
      secondaryTo: '/dashboard/client/cases',
    };
  }

  if (summary.activeCasesCount > 0 && primaryCase) {
    return {
      title: `Активных обращений: ${summary.activeCasesCount}`,
      description: `${primaryCase.title} — ${primaryCase.progressLabel}`,
      ctaLabel: 'Открыть обращение',
      ctaTo: `/dashboard/client/cases/${primaryCase.id}`,
      secondaryLabel: 'Все обращения',
      secondaryTo: '/dashboard/client/cases',
    };
  }

  if (!summary.hasAnyHistory) {
    return {
      title: 'Расскажите о проблеме — ИИ подскажет причины',
      description: '90% клиентов начинают с 2-минутной диагностики в чате.',
      ctaLabel: 'Начать диагностику',
      ctaTo: '/consult',
      isNewcomer: true,
    };
  }

  return {
    title: 'Всё в порядке! Нужна помощь снова?',
    description: 'Новая диагностика или запись — в пару кликов.',
    ctaLabel: 'Новая диагностика',
    ctaTo: '/consult',
    secondaryLabel: 'Записаться',
    secondaryTo: '/booking',
  };
}
