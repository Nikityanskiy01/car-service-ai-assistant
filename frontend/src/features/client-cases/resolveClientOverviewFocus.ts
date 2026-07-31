import type { ClientDashboardSummary } from './resolveClientHero';

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

function unreadTitle(count: number) {
  if (count === 1) return '1 новое сообщение';
  if (count < 5) return `${count} новых сообщения`;
  return `${count} новых сообщений`;
}

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
      secondaryLabel: 'Все обращения',
      secondaryTo: '/dashboard/client/cases?tab=drafts',
    });
  }

  if (summary.unreadMessagesCount > 0) {
    items.push({
      id: 'unread',
      kind: 'unread',
      accent: 'active',
      priority: 90,
      title: unreadTitle(summary.unreadMessagesCount),
      description: 'Откройте переписку, чтобы не пропустить ответ по ремонту.',
      ctaLabel: 'Открыть обращения',
      ctaTo: '/dashboard/client/cases',
    });
  }

  const primaryCase = summary.recentActiveCases[0];
  if (primaryCase?.status === 'NEW') {
    items.push({
      id: 'new-request',
      kind: 'new-request',
      accent: 'scheduled',
      priority: 60,
      title: 'Менеджер рассматривает обращение',
      description: `${primaryCase.title} — ${truncate(primaryCase.symptoms, 64)}`,
      ctaLabel: 'Открыть переписку',
      ctaTo: `/dashboard/client/cases/${primaryCase.id}?tab=messages`,
      secondaryLabel: 'Все обращения',
      secondaryTo: '/dashboard/client/cases',
    });
  }

  if (summary.activeCasesCount > 0 && primaryCase) {
    items.push({
      id: 'active',
      kind: 'active',
      accent: 'active',
      priority: 50,
      title: `Активных обращений: ${summary.activeCasesCount}`,
      description: `${primaryCase.title} — ${primaryCase.progressLabel}`,
      ctaLabel: 'Открыть обращение',
      ctaTo: `/dashboard/client/cases/${primaryCase.id}`,
      secondaryLabel: 'Все обращения',
      secondaryTo: '/dashboard/client/cases',
    });
  }

  if (items.length === 0) {
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

  const secondary = rest
    .filter((item) => item.id !== primary.id)
    .slice(0, 2);

  return { primary, secondary };
}
