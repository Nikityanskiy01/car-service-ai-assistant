import { describe, expect, it } from 'vitest';
import {
  formatRequestNumber,
  formatUrgencyLabel,
  SERVICE_REQUEST_STATUS_LABELS,
  URGENCY_LABELS,
} from './labels';

describe('labels', () => {
  it('formats request number without exposing full uuid', () => {
    expect(formatRequestNumber('abcdef12-3456-7890-abcd-ef1234567890')).toBe('ABCDEF12');
  });

  it('maps service request statuses to Russian labels', () => {
    expect(SERVICE_REQUEST_STATUS_LABELS.NEW).toBe('Новая');
    expect(SERVICE_REQUEST_STATUS_LABELS.IN_PROGRESS).toBe('В работе');
  });

  it('maps urgency codes to Russian labels', () => {
    expect(formatUrgencyLabel('medium')).toBe('Средняя срочность');
    expect(formatUrgencyLabel('HIGH')).toBe('Высокая срочность');
    expect(formatUrgencyLabel('unknown')).toBeNull();
    expect(URGENCY_LABELS.low).toBe('Не срочно');
  });
});
