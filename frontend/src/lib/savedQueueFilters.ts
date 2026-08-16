import { SLA_OVERDUE_LABEL } from './requestSla';

export type SavedQueueFilter = {
  id: string;
  label: string;
  params: Record<string, string>;
  /** Пресеты «из коробки» нельзя удалить, пользовательские можно. */
  builtIn?: boolean;
};

const STORAGE_KEY = 'manager-queue-filters-v2';
const LEGACY_STORAGE_KEY = 'manager-queue-filters-v1';

export const PRESET_QUEUE_FILTERS: SavedQueueFilter[] = [
  {
    id: 'new-critical',
    label: 'Новые · критичные',
    params: { status: 'NEW', urgency: 'critical' },
    builtIn: true,
  },
  {
    id: 'no-response',
    label: SLA_OVERDUE_LABEL,
    params: { sla: 'breached' },
    builtIn: true,
  },
  {
    id: 'mine-active',
    label: 'Мои в работе',
    params: { scope: 'mine', status: 'IN_PROGRESS' },
    builtIn: true,
  },
  {
    id: 'no-feedback',
    label: 'Без оценки ИИ',
    params: { feedback: 'none', status: 'COMPLETED' },
    builtIn: true,
  },
];

function readCustom(): SavedQueueFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedQueueFilter[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string' && item.params)
      .map((item) => ({ ...item, builtIn: false }));
  } catch {
    return [];
  }
}

function writeCustom(filters: SavedQueueFilter[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Приватный режим или переполненное хранилище: пресеты просто не переживут перезагрузку.
  }
}

export function loadSavedQueueFilters(): SavedQueueFilter[] {
  return [...PRESET_QUEUE_FILTERS, ...readCustom()];
}

export function saveQueueFilter(label: string, params: Record<string, string>): SavedQueueFilter[] {
  const trimmed = label.trim();
  if (!trimmed) return loadSavedQueueFilters();
  const custom = readCustom().filter((item) => item.label.toLowerCase() !== trimmed.toLowerCase());
  const next: SavedQueueFilter[] = [
    ...custom,
    { id: `custom-${Date.now().toString(36)}`, label: trimmed, params },
  ].slice(-12);
  writeCustom(next);
  return [...PRESET_QUEUE_FILTERS, ...next];
}

export function removeQueueFilter(id: string): SavedQueueFilter[] {
  const next = readCustom().filter((item) => item.id !== id);
  writeCustom(next);
  return [...PRESET_QUEUE_FILTERS, ...next];
}
