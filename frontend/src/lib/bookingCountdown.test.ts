import { describe, expect, it } from 'vitest';
import { formatBookingCountdown, getDaysUntilBooking } from './bookingCountdown';

describe('bookingCountdown', () => {
  const noon = new Date('2026-07-31T12:00:00');

  it('returns today for same calendar day', () => {
    expect(formatBookingCountdown('2026-07-31T18:00:00', noon.getTime())).toBe('Сегодня');
  });

  it('returns tomorrow label', () => {
    expect(formatBookingCountdown('2026-08-01T10:00:00', noon.getTime())).toBe('Завтра');
  });

  it('returns days until within a week', () => {
    expect(formatBookingCountdown('2026-08-03T10:00:00', noon.getTime())).toBe('Через 3 дн.');
  });

  it('returns null for distant bookings', () => {
    expect(formatBookingCountdown('2026-09-01T10:00:00', noon.getTime())).toBeNull();
  });

  it('counts calendar days', () => {
    expect(getDaysUntilBooking('2026-08-02T08:00:00', noon.getTime())).toBe(2);
  });
});
