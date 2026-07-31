import { describe, expect, it } from 'vitest';
import {
  resolveOverviewFocus,
  shouldShowBookingAlert,
  shouldShowBookingSection,
} from './resolveOverviewFocus';
import type { ClientDashboardSummary } from './resolveClientHero';
import { resolveClientHero } from './resolveClientHero';

function baseSummary(overrides: Partial<ClientDashboardSummary> = {}): ClientDashboardSummary {
  return {
    profile: { fullName: 'Иван', phone: null },
    activeCasesCount: 0,
    unreadMessagesCount: 0,
    hasAnyHistory: true,
    nextBooking: null,
    draftConsultation: null,
    recentActiveCases: [],
    ...overrides,
  };
}

describe('resolveOverviewFocus', () => {
  it('returns null for newcomer', () => {
    const summary = baseSummary({ hasAnyHistory: false });
    const hero = resolveClientHero(summary);
    expect(resolveOverviewFocus(summary, hero)).toBeNull();
  });

  it('prioritizes draft over booking', () => {
    const summary = baseSummary({
      draftConsultation: { id: 'd1', make: 'BMW', model: 'X5', symptom: 'Стук' },
      nextBooking: { id: 'b1', preferredAt: '2026-08-01T10:00:00', status: 'CONFIRMED' },
    });
    const hero = resolveClientHero(summary);
    const focus = resolveOverviewFocus(summary, hero);
    expect(focus?.type).toBe('draft');
  });

  it('shows booking focus within 14 days', () => {
    const summary = baseSummary({
      nextBooking: { id: 'b1', preferredAt: '2026-08-10T10:00:00', status: 'CONFIRMED' },
    });
    const hero = resolveClientHero(summary);
    const focus = resolveOverviewFocus(summary, hero);
    expect(focus?.type).toBe('booking');
    expect(shouldShowBookingSection(summary, focus)).toBe(false);
    expect(shouldShowBookingAlert(focus)).toBe(false);
  });

  it('falls back to hero when booking is far away', () => {
    const summary = baseSummary({
      nextBooking: { id: 'b1', preferredAt: '2026-10-01T10:00:00', status: 'CONFIRMED' },
    });
    const hero = resolveClientHero(summary);
    const focus = resolveOverviewFocus(summary, hero);
    expect(focus?.type).toBe('hero');
    expect(shouldShowBookingSection(summary, focus)).toBe(true);
  });
});
