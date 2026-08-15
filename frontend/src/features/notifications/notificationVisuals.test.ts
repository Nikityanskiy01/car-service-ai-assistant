import { describe, expect, it } from 'vitest';
import {
  formatNotificationDateGroup,
  groupNotificationsByDate,
  resolveNotificationVisual,
} from './notificationVisuals';

describe('notificationVisuals', () => {
  it('maps booking kinds to booking tone', () => {
    const visual = resolveNotificationVisual('BOOKING_CONFIRMED');
    expect(visual.tone).toBe('booking');
    expect(visual.categoryLabel).toBe('Подтверждение');
  });

  it('maps manager messages to message tone', () => {
    const visual = resolveNotificationVisual('MANAGER_MESSAGE');
    expect(visual.tone).toBe('message');
    expect(visual.actionLabel).toBe('Открыть переписку');
  });

  it('groups items by relative day label', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const groups = groupNotificationsByDate([
      { createdAt: now.toISOString(), id: 'a' },
      { createdAt: yesterday.toISOString(), id: 'b' },
    ]);
    expect(groups.length).toBe(2);
    expect(groups[0].label).toBe('Сегодня');
    expect(formatNotificationDateGroup(yesterday.toISOString())).toBe('Вчера');
  });
});
