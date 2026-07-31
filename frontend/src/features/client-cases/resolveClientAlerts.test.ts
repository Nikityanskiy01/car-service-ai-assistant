import { describe, expect, it } from 'vitest';
import { resolveClientAlerts, resolveClientOverviewSubtitle } from './resolveClientAlerts';
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

describe('resolveClientAlerts', () => {
  it('prioritizes unread messages and draft', () => {
    const alerts = resolveClientAlerts({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: 3,
      draftConsultation: {
        id: 'sess-1',
        make: 'Toyota',
        model: 'Camry',
        symptom: 'Стук',
      },
    });

    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.id).toBe('unread');
    expect(alerts[1]?.id).toBe('draft');
  });

  it('limits alerts to two items', () => {
    const alerts = resolveClientAlerts({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: 2,
      draftConsultation: { id: 'sess-1', make: 'BMW', model: 'X5', symptom: 'Шум' },
      nextBooking: {
        id: 'b1',
        preferredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'CONFIRMED',
      },
    });

    expect(alerts.length).toBeLessThanOrEqual(2);
  });
});

describe('resolveClientOverviewSubtitle', () => {
  it('returns newcomer subtitle', () => {
    expect(resolveClientOverviewSubtitle(base)).toContain('диагностики');
  });

  it('returns active cases subtitle', () => {
    expect(
      resolveClientOverviewSubtitle({
        ...base,
        hasAnyHistory: true,
        activeCasesCount: 2,
      }),
    ).toContain('ремонта');
  });
});
