import { describe, expect, it } from 'vitest';
import { buildClientCases, filterCasesByTab } from './buildClientCases';

describe('buildClientCases', () => {
  it('groups service requests and draft consultations', () => {
    const cases = buildClientCases(
      [
        {
          id: 'consult-draft',
          status: 'IN_PROGRESS',
          createdAt: '2026-07-01T10:00:00.000Z',
          make: 'Toyota',
          model: 'Camry',
          symptoms: 'Стук при торможении',
        },
        {
          id: 'consult-linked',
          status: 'COMPLETED',
          createdAt: '2026-06-01T10:00:00.000Z',
          make: 'BMW',
          model: 'X5',
          serviceRequest: { id: 'req-1', status: 'IN_PROGRESS' },
        },
      ],
      [
        {
          id: 'req-1',
          status: 'IN_PROGRESS',
          createdAt: '2026-06-02T10:00:00.000Z',
          snapshotMake: 'BMW',
          snapshotModel: 'X5',
          snapshotSymptoms: 'Биение руля',
          consultationSessionId: 'consult-linked',
        },
      ],
      [
        {
          id: 'booking-1',
          status: 'CONFIRMED',
          preferredAt: '2026-07-10T10:00:00.000Z',
          serviceRequest: { id: 'req-1', status: 'IN_PROGRESS' },
        },
      ],
    );

    expect(cases).toHaveLength(2);
    expect(cases.find((c) => c.id === 'req-1')?.kind).toBe('request');
    expect(cases.find((c) => c.id === 'req-1')?.bookingId).toBe('booking-1');
    expect(cases.find((c) => c.id === 'consult-draft')?.kind).toBe('draft');
  });

  it('filters tabs', () => {
    const cases = buildClientCases(
      [{ id: 'draft-1', status: 'IN_PROGRESS', createdAt: '2026-07-01T10:00:00.000Z' }],
      [
        { id: 'req-active', status: 'NEW', createdAt: '2026-07-02T10:00:00.000Z' },
        { id: 'req-done', status: 'COMPLETED', createdAt: '2026-06-01T10:00:00.000Z' },
      ],
      [],
    );

    expect(filterCasesByTab(cases, 'active')).toHaveLength(1);
    expect(filterCasesByTab(cases, 'archive')).toHaveLength(1);
    expect(filterCasesByTab(cases, 'drafts')).toHaveLength(1);
  });
});
