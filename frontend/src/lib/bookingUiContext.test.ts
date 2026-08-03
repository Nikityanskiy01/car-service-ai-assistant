import { describe, expect, it } from 'vitest';
import { resolveBookingUiContext } from './bookingUiContext';

describe('resolveBookingUiContext', () => {
  const aug3 = new Date('2026-08-03T12:00:00').getTime();

  it('shows awaiting confirmation for pending past visits', () => {
    const ctx = resolveBookingUiContext('2026-07-31T01:14:00', 'PENDING', aug3);
    expect(ctx.dateBadge).toBe('Ждём подтверждения');
    expect(ctx.showPastChip).toBe(false);
    expect(ctx.canManage).toBe(true);
    expect(ctx.showCallPrimary).toBe(true);
    expect(ctx.showCalendarPrimary).toBe(false);
  });

  it('shows countdown for pending future visits', () => {
    const ctx = resolveBookingUiContext('2026-08-05T10:00:00', 'PENDING', aug3);
    expect(ctx.dateBadge).toBe('Через 2 дн.');
    expect(ctx.showPastChip).toBe(false);
    expect(ctx.showCalendar).toBe(true);
  });

  it('shows past chip for confirmed past visits', () => {
    const ctx = resolveBookingUiContext('2026-07-31T01:14:00', 'CONFIRMED', aug3);
    expect(ctx.dateBadge).toBe('Прошло');
    expect(ctx.showPastChip).toBe(true);
    expect(ctx.showBookAgain).toBe(true);
  });

  it('prioritizes calendar for confirmed upcoming visits', () => {
    const ctx = resolveBookingUiContext('2026-08-05T10:00:00', 'CONFIRMED', aug3);
    expect(ctx.showCalendarPrimary).toBe(true);
    expect(ctx.canManage).toBe(true);
    expect(ctx.dateBadge).toBe('Через 2 дн.');
  });
});
