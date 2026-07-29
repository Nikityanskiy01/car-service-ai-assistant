import { describe, expect, it } from 'vitest';
import { buildBookingIcs } from './buildBookingIcs';

describe('buildBookingIcs', () => {
  it('builds valid calendar event', () => {
    const ics = buildBookingIcs({
      id: 'bk-1',
      preferredAt: '2026-07-15T10:00:00.000Z',
      title: 'ТО автомобиля',
      location: 'Москва',
      description: 'Комментарий клиента',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('UID:booking-bk-1@autoservice');
    expect(ics).toContain('SUMMARY:ТО автомобиля');
    expect(ics).toContain('LOCATION:Москва');
    expect(ics).toContain('DESCRIPTION:Комментарий клиента');
    expect(ics).toContain('DTSTART:20260715T100000Z');
    expect(ics).toContain('DTEND:20260715T110000Z');
    expect(ics).toContain('END:VEVENT');
  });
});
