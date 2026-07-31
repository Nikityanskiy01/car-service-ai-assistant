import { describe, expect, it } from 'vitest';
import {
  formatBookingRelative,
  getBookingSubtitle,
  getBookingTitle,
} from './bookingDisplay';
import type { ServiceBooking } from '../types/dashboard';

const booking: ServiceBooking = {
  id: 'b1',
  status: 'CONFIRMED',
  preferredAt: '2026-08-01T10:00:00.000Z',
  serviceRequest: {
    id: 'r1',
    status: 'SCHEDULED',
    snapshotMake: 'Toyota',
    snapshotModel: 'Camry',
    snapshotSymptoms: 'Стук в подвеске',
  },
};

describe('bookingDisplay', () => {
  it('builds title from vehicle', () => {
    expect(getBookingTitle(booking)).toBe('Toyota Camry');
  });

  it('builds subtitle from symptoms', () => {
    expect(getBookingSubtitle(booking)).toBe('Стук в подвеске');
  });

  it('formats relative time for upcoming visits', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatBookingRelative(future)).toMatch(/через 2 дн/);
  });
});
