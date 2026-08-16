import type { ClientDashboardSummary } from './resolveClientHero';

export type ClientAlert = {
  id: string;
  tone: 'primary' | 'warning' | 'info';
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  ctaSessionId?: string;
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

function unreadLabel(thread: { unreadCount: number; title?: string }, fallbackCount: number) {
  const count = thread.unreadCount || fallbackCount;
  const name = thread.title;
  if (name) {
    if (count === 1) return `Новое сообщение: ${name}`;
    if (count < 5) return `${count} новых сообщения: ${name}`;
    return `${count} новых сообщений: ${name}`;
  }
  if (count === 1) return '1 новое сообщение от менеджера';
  if (count < 5) return `${count} новых сообщения от менеджера`;
  return `${count} новых сообщений от менеджера`;
}

export function resolveClientAlerts(summary: ClientDashboardSummary): ClientAlert[] {
  const alerts: ClientAlert[] = [];
  const threads = summary.unreadThreads?.length
    ? summary.unreadThreads
    : summary.unreadMessagesCount > 0
      ? [{ requestId: '', title: '', unreadCount: summary.unreadMessagesCount, lastMessagePreview: '' }]
      : [];

  for (const thread of threads.slice(0, 2)) {
    alerts.push({
      id: thread.requestId ? `unread-${thread.requestId}` : 'unread',
      tone: 'info',
      title: unreadLabel(thread, summary.unreadMessagesCount),
      description: thread.lastMessagePreview
        ? `«${truncate(thread.lastMessagePreview, 72)}»`
        : 'Откройте переписку, чтобы не пропустить ответ по ремонту.',
      ctaLabel: 'Открыть чат',
      ctaTo: thread.requestId
        ? `/dashboard/client/cases/${thread.requestId}?tab=messages`
        : '/dashboard/client/cases',
    });
  }

  const draft = summary.draftConsultation;
  if (draft?.id) {
    const vehicle = [draft.make, draft.model].filter(Boolean).join(' ');
    alerts.push({
      id: 'draft',
      tone: 'info',
      title: vehicle ? `Незавершённая диагностика: ${vehicle}` : 'Диагностика не завершена',
      description: draft.symptom
        ? truncate(draft.symptom, 72)
        : 'Вернитесь в чат и уточните симптомы — это займёт минуту.',
      ctaLabel: 'Продолжить',
      ctaTo: '/consult',
      ctaSessionId: draft.id,
    });
  }

  if (summary.nextBooking) {
    const bookingTime = new Date(summary.nextBooking.preferredAt).getTime();
    const daysUntil = (bookingTime - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntil <= 7) {
      alerts.push({
        id: 'booking',
        tone: 'info',
        title: `Запись: ${formatBookingDate(summary.nextBooking.preferredAt)}`,
        description:
          summary.nextBooking.status === 'CONFIRMED'
            ? 'Запись подтверждена — ждём вас в сервисе.'
            : 'Сначала согласуйте время — до подтверждения запись не окончательная.',
        ctaLabel: 'Детали записи',
        ctaTo: `/dashboard/client/bookings/${summary.nextBooking.id}`,
      });
    }
  }

  const primaryCase = summary.recentActiveCases[0];
  if (primaryCase?.status === 'NEW' && !alerts.some((item) => item.id === 'unread')) {
    alerts.push({
      id: 'new-request',
      tone: 'info',
      title: 'Менеджер рассматривает обращение',
      description: `${primaryCase.title} — ${truncate(primaryCase.symptoms, 64)}`,
      ctaLabel: 'Открыть переписку',
      ctaTo: `/dashboard/client/cases/${primaryCase.id}?tab=messages`,
    });
  }

  return alerts.slice(0, 2);
}

export function resolveClientOverviewSubtitle(summary: ClientDashboardSummary): string {
  if (!summary.hasAnyHistory) {
    return 'Начните с диагностики — это займёт пару минут.';
  }
  if (summary.activeCasesCount > 0) {
    return 'Следите за статусом ремонта и перепиской с мастером.';
  }
  if (summary.nextBooking) {
    return 'Ближайшая запись уже в расписании — детали ниже.';
  }
  return 'Всё спокойно — мы на связи, если понадобится помощь.';
}
