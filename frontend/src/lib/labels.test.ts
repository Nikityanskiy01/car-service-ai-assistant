import { describe, expect, it } from 'vitest';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from './labels';

describe('labels', () => {
  it('formats request number without exposing full uuid', () => {
    expect(formatRequestNumber('abcdef12-3456-7890-abcd-ef1234567890')).toBe('ABCDEF12');
  });

  it('maps service request statuses to Russian labels', () => {
    expect(SERVICE_REQUEST_STATUS_LABELS.NEW).toBe('Новая');
    expect(SERVICE_REQUEST_STATUS_LABELS.IN_PROGRESS).toBe('В работе');
  });
});
