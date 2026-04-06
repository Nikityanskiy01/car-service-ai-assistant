import { assertPreferredAtInBookingWindow, getWallClockInTimeZone } from '../../src/lib/bookingHours.js';

describe('booking hours (Europe/Moscow)', () => {
  it('allows 09:00 MSK and rejects 08:59', () => {
    const ok = assertPreferredAtInBookingWindow('2026-06-01T06:00:00.000Z');
    expect(ok.ok).toBe(true);
    const bad = assertPreferredAtInBookingWindow('2026-06-01T05:59:00.000Z');
    expect(bad.ok).toBe(false);
  });

  it('allows 20:59 MSK and rejects 21:00', () => {
    const ok = assertPreferredAtInBookingWindow('2026-06-01T17:59:00.000Z');
    expect(ok.ok).toBe(true);
    const bad = assertPreferredAtInBookingWindow('2026-06-01T18:00:00.000Z');
    expect(bad.ok).toBe(false);
  });

  it('getWallClockInTimeZone returns parts for valid date', () => {
    const w = getWallClockInTimeZone('2026-06-01T12:00:00.000Z');
    expect(w).toEqual({ hour: 15, minute: 0 });
  });
});
