import { describe, expect, it } from 'vitest';
import {
  formatBookingRelative,
  formatBookingRequestOption,
  formatBookingRequestSummary,
  getBookingSubtitle,
  getBookingTitle,
  requestCarDiffersFromBooking,
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
  it('builds title from linked request', () => {
    expect(getBookingTitle(booking)).toBe('Toyota Camry');
  });

  it('builds title from garage vehicle', () => {
    expect(
      getBookingTitle({
        ...booking,
        serviceRequest: null,
        vehicle: { id: 'v1', make: 'Renault', model: 'Duster' },
      }),
    ).toBe('Renault Duster');
  });

  it('builds subtitle from symptoms', () => {
    expect(getBookingSubtitle(booking)).toBe('Стук в подвеске');
  });

  it('formats relative time for upcoming visits', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatBookingRelative(future)).toMatch(/через 2 дн/);
  });

  it('labels a request by number and topic, not only by car', () => {
    expect(
      formatBookingRequestOption({
        id: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
        snapshotMake: 'Hyundai',
        snapshotModel: 'Solaris',
        snapshotSymptoms: 'Скрип тормозов',
        createdAt: '2026-08-12T10:00:00.000Z',
      }),
    ).toMatch(/^№AAAABBBB · Скрип тормозов · Hyundai Solaris/);
  });

  it('falls back to car when the request has no symptoms', () => {
    expect(
      formatBookingRequestOption({
        id: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
        snapshotMake: 'Hyundai',
        snapshotModel: 'Solaris',
      }),
    ).toBe('№AAAABBBB · Hyundai Solaris');
  });

  it('summarizes a linked request for review and chips', () => {
    expect(
      formatBookingRequestSummary({
        id: 'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
        snapshotSymptoms: 'Скрип тормозов',
      }),
    ).toBe('№AAAABBBB · Скрип тормозов');
  });

  it('detects when the request car is not the booking car', () => {
    expect(
      requestCarDiffersFromBooking(
        { snapshotMake: 'Hyundai', snapshotModel: 'Solaris' },
        'Renault Duster 2018',
      ),
    ).toBe(true);
    expect(
      requestCarDiffersFromBooking(
        { snapshotMake: 'Renault', snapshotModel: 'Duster' },
        'Renault Duster 2018',
      ),
    ).toBe(false);
  });
});
