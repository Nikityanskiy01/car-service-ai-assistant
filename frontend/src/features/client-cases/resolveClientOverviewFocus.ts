import type { ClientDashboardSummary, ClientUnreadThread } from './resolveClientHero';

export type OverviewFocusAccent = 'new' | 'active' | 'scheduled' | 'confirmed' | 'done' | 'muted';

export type OverviewFocusItem = {
  id: string;
  kind: 'draft' | 'unread' | 'booking' | 'new-request' | 'active' | 'idle';
  accent: OverviewFocusAccent;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  ctaSessionId?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  priority: number;
};

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function unreadCountLabel(count: number) {
  if (count === 1) return '1 новое сообщение';
  if (count < 5) return `${count} новых сообщения`;
  return `${count} новых сообщений`;
}

function unreadThreadTitle(thread: ClientUnreadThread) {
  const name = thread.title || 'обращению';
  if (thread.unreadCount <= 1) return `Ответ по ${name}`;
  return `${unreadCountLabel(thread.unreadCount)} — ${name}`;
}

function unreadThreadDescription(thread: ClientUnreadThread) {
  if (thread.lastMessagePreview) {
    return `«${truncate(thread.lastMessagePreview, 80)}»`;
  }
  if (thread.symptoms) {
    return `${truncate(thread.symptoms, 56)} — откройте этот чат.`;
  }
  return 'Откройте этот чат, чтобы не пропустить ответ.';
}

function unreadThreadItems(summary: ClientDashboardSummary): OverviewFocusItem[] {
  const threads = summary.unreadThreads?.length
    ? summary.unreadThreads
    : summary.unreadMessagesCount > 0
      ? [
          {
            requestId: '',
            title: '',
            symptoms: '',
            unreadCount: summary.unreadMessagesCount,
            lastMessagePreview: '',
            lastMessageAt: '',
          } satisfies ClientUnreadThread,
        ]
      : [];

  return threads.map((thread, index) => ({
    id: thread.requestId ? `unread-${thread.requestId}` : 'unread',
    kind: 'unread',
    accent: 'active',
    priority: 90 - index,
    title: thread.title ? unreadThreadTitle(thread) : unreadCountLabel(thread.unreadCount),
    description: thread.requestId
      ? unreadThreadDescription(thread)
      : 'Откройте переписку, чтобы не пропустить ответ по ремонту.',
    ctaLabel: 'Открыть чат',
    ctaTo: thread.requestId
      ? `/dashboard/client/cases/${thread.requestId}?tab=messages`
      : '/dashboard/client/cases',
  }));
}

/**
 * На главной — одно действие «сейчас».
 * Статусы заявок не дублируем: они в блоке «В работе».
 * Idle показываем только когда действительно нечем заняться.
 */
function buildFocusItems(summary: ClientDashboardSummary): OverviewFocusItem[] {
  const items: OverviewFocusItem[] = [];

  const draft = summary.draftConsultation;
  if (draft?.id) {
    const vehicle = [draft.make, draft.model].filter(Boolean).join(' ');
    const symptom = draft.symptom ? truncate(draft.symptom, 56) : '';
    const hasMeaningfulSymptom =
      symptom && !/продолжите описание/i.test(symptom) && symptom.length > 3;
    items.push({
      id: 'draft',
      kind: 'draft',
      accent: 'new',
      priority: 100,
      title: vehicle ? `Продолжить диагностику: ${vehicle}` : 'Диагностика не завершена',
      description: hasMeaningfulSymptom
        ? `«${symptom}» — вернитесь в чат и уточните детали.`
        : 'Диалог не завершён — можно вернуться в чат и уточнить детали.',
      ctaLabel: 'Продолжить в чате',
      ctaTo: '/consult',
      ctaSessionId: draft.id,
      secondaryLabel: 'Черновики',
      secondaryTo: '/dashboard/client/cases?tab=drafts',
    });
  }

  items.push(...unreadThreadItems(summary));

  if (items.length === 0) {
    // Есть заявки или запись — отдельный hero не нужен, список/spotlight закрывают вопрос.
    if (summary.activeCasesCount > 0 || summary.nextBooking) {
      return [];
    }

    items.push({
      id: 'idle',
      kind: 'idle',
      accent: 'muted',
      priority: 10,
      title: 'Всё спокойно',
      description: 'Новая диагностика или запись — в пару кликов.',
      ctaLabel: 'Новая диагностика',
      ctaTo: '/consult',
      secondaryLabel: 'Записаться',
      secondaryTo: '/booking',
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}

export function resolveClientOverviewFocus(summary: ClientDashboardSummary): {
  primary: OverviewFocusItem;
  secondary: OverviewFocusItem[];
} | null {
  if (!summary.hasAnyHistory && !summary.draftConsultation) {
    return null;
  }

  const items = buildFocusItems(summary);
  const [primary, ...rest] = items;
  if (!primary) return null;

  const secondary = rest.filter((item) => item.kind === 'unread' && item.id !== primary.id);

  return { primary, secondary };
}
