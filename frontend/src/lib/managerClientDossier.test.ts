import { describe, expect, it } from 'vitest';
import {
  buildClientDossierView,
  clientInitials,
  firstNameOf,
  formatLtv,
  rosterVehicleSummary,
  statusVariant,
  vehicleLine,
  visitParts,
} from './managerClientDossier';

describe('managerClientDossier', () => {
  it('summarizes garage in the roster', () => {
    expect(
      rosterVehicleSummary({
        key: '1',
        name: 'Анна',
        phone: '79991110001',
        isGuest: false,
        totalRequests: 1,
        activeRequests: 0,
        lastActivityAt: null,
        vehicles: [
          { make: 'Kia', model: 'Rio', licensePlate: 'A123BC777' },
          { make: 'Ford', model: 'Focus' },
        ],
      }),
    ).toBe('Kia Rio · A123BC777 +1');
  });

  it('joins plate onto the car line', () => {
    expect(vehicleLine({ make: 'Kia', model: 'Rio', year: 2019, licensePlate: 'A123BC777' })).toBe(
      'Kia Rio 2019 · A123BC777',
    );
  });

  it('builds a guest view from dossier payloads', () => {
    const view = buildClientDossierView(
      {
        key: 'guest:7999',
        name: 'Гость Игорь',
        phone: '79992220002',
        isGuest: true,
        totalRequests: 1,
        activeRequests: 1,
        lastActivityAt: null,
      },
      null,
      {
        profile: { phone: '79992220002', fullName: 'Игорь Петров', isGuest: true },
        vehicles: [{ make: 'Ford', model: 'Focus' }],
        requests: [],
        bookings: [],
        contacts: [],
        metrics: { requestsTotal: 0, completedRequests: 0, ltvMinor: 0, repairsWithAmount: 0 },
      },
    );
    expect(view?.name).toBe('Игорь Петров');
    expect(view?.isGuest).toBe(true);
    expect(view?.vehicles[0].make).toBe('Ford');
  });

  it('takes initials from first and last name', () => {
    expect(clientInitials('Анна Ковалева')).toBe('АК');
    expect(clientInitials('Гость Игорь')).toBe('ИГ');
  });

  it('keeps the first name for the dossier rail', () => {
    expect(firstNameOf('Марина Орлова')).toBe('Марина');
    expect(firstNameOf('Гость Игорь Петров')).toBe('Игорь');
  });

  it('tones statuses so the rail can be scanned', () => {
    expect(statusVariant('NEW')).toBe('default');
    expect(statusVariant('IN_PROGRESS')).toBe('warning');
    expect(statusVariant('SCHEDULED')).toBe('secondary');
    expect(statusVariant('CONFIRMED')).toBe('success');
    expect(statusVariant('CANCELLED')).toBe('destructive');
  });

  it('splits the next visit into day, weekday and time', () => {
    const parts = visitParts('2026-08-17T10:00:00.000Z');
    expect(parts?.day).toMatch(/17/);
    expect(parts?.time).toMatch(/\d{2}:\d{2}/);
    expect(parts?.weekday).toBeTruthy();
    expect(visitParts(null)).toBeNull();
  });

  it('hides zero LTV', () => {
    expect(formatLtv(0)).toBeNull();
    expect(formatLtv(1240000)).toMatch(/12\D?400/);
  });
});
