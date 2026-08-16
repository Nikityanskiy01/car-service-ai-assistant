import { describe, expect, it } from 'vitest';
import { addDays, daysInRange, formatRangeLabel, isoDay, startOfLocalDay } from './calendarDays';

describe('calendarDays', () => {
  it('builds a 7-day window from a local midnight', () => {
    const start = startOfLocalDay(new Date(2026, 7, 16));
    const days = daysInRange(start, 7);

    expect(days).toHaveLength(7);
    expect(isoDay(days[0])).toBe('2026-08-16');
    expect(isoDay(days[6])).toBe('2026-08-22');
    expect(days[0].getHours()).toBe(0);
  });

  it('formats a same-month week without repeating the month', () => {
    expect(formatRangeLabel(new Date(2026, 7, 16), 7)).toBe('16-22 августа');
  });

  it('formats a single day with weekday', () => {
    expect(formatRangeLabel(new Date(2026, 7, 16), 1)).toBe('Воскресенье, 16 августа');
  });

  it('formats a range that crosses months', () => {
    expect(formatRangeLabel(new Date(2026, 7, 30), 7)).toBe('30 августа - 5 сентября');
  });

  it('shifts by whole local days', () => {
    const next = addDays(new Date(2026, 7, 16, 18, 40), 7);
    expect(isoDay(next)).toBe('2026-08-23');
    expect(next.getHours()).toBe(0);
  });
});
