import { describe, expect, it } from 'vitest';
import { resolveClientOverviewFocus } from './resolveClientOverviewFocus';
import type { ClientDashboardSummary } from './resolveClientHero';

const base: ClientDashboardSummary = {
  profile: { fullName: 'Иван', phone: '+79990000000' },
  activeCasesCount: 0,
  unreadMessagesCount: 0,
  hasAnyHistory: false,
  nextBooking: null,
  draftConsultation: null,
  recentActiveCases: [],
};

describe('resolveClientOverviewFocus', () => {
  it('returns null for newcomer without draft', () => {
    expect(resolveClientOverviewFocus(base)).toBeNull();
  });

  it('prioritizes draft as primary and unread as secondary', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: 8,
      draftConsultation: {
        id: 'sess-1',
        make: 'Toyota',
        model: 'Camry',
        symptom: 'Стук',
      },
    });

    expect(focus?.primary.id).toBe('draft');
    expect(focus?.secondary.map((item) => item.id)).toEqual(['unread']);
  });

  it('does not duplicate draft in secondary list', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      draftConsultation: { id: 'sess-1', make: 'Kia', model: 'Rio', symptom: 'Шум' },
      nextBooking: {
        id: 'b1',
        preferredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'CONFIRMED',
      },
    });

    expect(focus?.primary.id).toBe('draft');
    expect(focus?.secondary.some((item) => item.id === 'draft')).toBe(false);
  });
});
