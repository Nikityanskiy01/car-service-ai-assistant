import { describe, expect, it } from 'vitest';
import { resolveClientHero } from './resolveClientHero';
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

describe('resolveClientHero', () => {
  it('shows newcomer hero', () => {
    const hero = resolveClientHero(base);
    expect(hero.isNewcomer).toBe(true);
    expect(hero.ctaTo).toBe('/consult');
  });

  it('prioritizes draft consultation', () => {
    const hero = resolveClientHero({
      ...base,
      hasAnyHistory: true,
      draftConsultation: {
        id: 'sess-1',
        make: 'Toyota',
        model: 'Camry',
        symptom: 'Стук',
      },
    });
    expect(hero.ctaSessionId).toBe('sess-1');
    expect(hero.title).toContain('Toyota Camry');
  });

  it('shows booking hero when no draft', () => {
    const hero = resolveClientHero({
      ...base,
      hasAnyHistory: true,
      nextBooking: {
        id: 'b1',
        preferredAt: '2026-08-01T10:00:00.000Z',
        status: 'CONFIRMED',
      },
    });
    expect(hero.ctaTo).toBe('/dashboard/client/bookings/b1');
  });
});
