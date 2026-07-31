import { describe, expect, it } from 'vitest';
import { buildClientCases, filterCasesByTab, filterCasesByVehicle } from './buildClientCases';

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

  it('filters cases by vehicle id and make/model fallback', () => {
    const cases = buildClientCases(
      [
        {
          id: 'consult-1',
          status: 'IN_PROGRESS',
          createdAt: '2026-07-01T10:00:00.000Z',
          make: 'Toyota',
          model: 'Camry',
          vehicleId: 'veh-1',
        },
        {
          id: 'consult-2',
          status: 'IN_PROGRESS',
          createdAt: '2026-07-02T10:00:00.000Z',
          make: 'BMW',
          model: 'X5',
        },
      ],
      [],
      [],
    );

    const byId = filterCasesByVehicle(cases, { id: 'veh-1', make: 'Toyota', model: 'Camry' });
    expect(byId).toHaveLength(1);
    expect(byId[0]?.id).toBe('consult-1');

    const byMakeModel = filterCasesByVehicle(cases, { id: 'veh-2', make: 'BMW', model: 'X5' });
    expect(byMakeModel).toHaveLength(1);
    expect(byMakeModel[0]?.id).toBe('consult-2');
  });
});
