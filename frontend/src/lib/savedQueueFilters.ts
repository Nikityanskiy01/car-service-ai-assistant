export type SavedQueueFilter = {
  id: string;
  label: string;
  params: Record<string, string>;
};

const STORAGE_KEY = 'manager-queue-filters-v1';

export const PRESET_QUEUE_FILTERS: SavedQueueFilter[] = [
  {
    id: 'new-critical',
    label: 'Новые + critical',
    params: { status: 'NEW', urgency: 'critical' },
  },
  {
    id: 'no-response',
    label: 'Без ответа (SLA)',
    params: { sla: 'breached' },
  },
  {
    id: 'no-feedback',
    label: 'Без оценки ИИ',
    params: { feedback: 'none', status: 'COMPLETED' },
  },
];

export function loadSavedQueueFilters(): SavedQueueFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PRESET_QUEUE_FILTERS;
    const parsed = JSON.parse(raw) as SavedQueueFilter[];
    return Array.isArray(parsed) && parsed.length ? parsed : PRESET_QUEUE_FILTERS;
  } catch {
    return PRESET_QUEUE_FILTERS;
  }
}
