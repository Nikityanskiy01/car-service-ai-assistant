import { formatBookingDateParts, formatBookingRelative } from '../../lib/bookingDisplay';
import type { ClientCase } from './types';

export type CaseVisualGroup = 'waiting' | 'working' | 'scheduled' | 'draft' | 'done' | 'cancelled';

export type CasePresentation = {
  group: CaseVisualGroup;
  groupLabel: string;
  statusLine: string;
  detailLine: string | null;
  ctaLabel: string;
  attention: boolean;
  bookingParts: ReturnType<typeof formatBookingDateParts> | null;
  bookingRelative: string | null;
};

const GROUP_ORDER: CaseVisualGroup[] = [
  'waiting',
  'working',
  'scheduled',
  'draft',
  'done',
  'cancelled',
];

const GROUP_LABELS: Record<CaseVisualGroup, string> = {
  waiting: 'Ждут ответа',
  working: 'В работе',
  scheduled: 'С записью',
  draft: 'Черновики',
  done: 'Завершённые',
  cancelled: 'Отменённые',
};

export function presentClientCase(clientCase: ClientCase): CasePresentation {
  const isDraft = clientCase.kind === 'draft';
  const status = clientCase.requestStatus || clientCase.status;
  const bookingParts = clientCase.bookingPreferredAt
    ? formatBookingDateParts(clientCase.bookingPreferredAt)
    : null;
  const bookingRelative = clientCase.bookingPreferredAt
    ? formatBookingRelative(clientCase.bookingPreferredAt)
    : null;

  if (isDraft) {
    return {
      group: 'draft',
      groupLabel: GROUP_LABELS.draft,
      statusLine:
        clientCase.consultationStatus === 'COMPLETED'
          ? 'Диагностика готова'
          : 'Незавершённая диагностика',
      detailLine: null,
      ctaLabel: 'Продолжить',
      attention: true,
      bookingParts: null,
      bookingRelative: null,
    };
  }

  if (status === 'CANCELLED') {
    return {
      group: 'cancelled',
      groupLabel: GROUP_LABELS.cancelled,
      statusLine: 'Отменено',
      detailLine: null,
      ctaLabel: 'Открыть',
      attention: false,
      bookingParts: null,
      bookingRelative: null,
    };
  }

  if (status === 'COMPLETED') {
    return {
      group: 'done',
      groupLabel: GROUP_LABELS.done,
      statusLine: 'Ремонт завершён',
      detailLine: null,
      ctaLabel: 'Открыть',
      attention: false,
      bookingParts: null,
      bookingRelative: null,
    };
  }

  if (status === 'SCHEDULED' || clientCase.bookingPreferredAt) {
    return {
      group: 'scheduled',
      groupLabel: GROUP_LABELS.scheduled,
      statusLine: bookingParts ? `Запись ${bookingParts.short}` : 'Запись назначена',
      detailLine: bookingRelative,
      ctaLabel: 'К записи',
      attention: false,
      bookingParts,
      bookingRelative,
    };
  }

  if (status === 'IN_PROGRESS') {
    return {
      group: 'working',
      groupLabel: GROUP_LABELS.working,
      statusLine: 'Мастер работает',
      detailLine: null,
      ctaLabel: 'Открыть',
      attention: false,
      bookingParts: null,
      bookingRelative: null,
    };
  }

  return {
    group: 'waiting',
    groupLabel: GROUP_LABELS.waiting,
    statusLine: 'Ждём менеджера',
    detailLine: null,
    ctaLabel: 'Открыть',
    attention: true,
    bookingParts: null,
    bookingRelative: null,
  };
}

export function groupClientCases(cases: ClientCase[]): Array<{
  group: CaseVisualGroup;
  label: string;
  items: ClientCase[];
}> {
  const buckets = new Map<CaseVisualGroup, ClientCase[]>();
  for (const item of cases) {
    const { group } = presentClientCase(item);
    const list = buckets.get(group) || [];
    list.push(item);
    buckets.set(group, list);
  }

  return GROUP_ORDER.filter((group) => (buckets.get(group)?.length || 0) > 0).map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: buckets.get(group) || [],
  }));
}
