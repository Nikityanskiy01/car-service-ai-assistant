import { buildClientCasesFromDb } from '../../src/lib/clientCases.js';

describe('buildClientCasesFromDb', () => {
  it('builds request and draft cases', () => {
    const createdAt = new Date('2026-07-01T10:00:00.000Z');
    const cases = buildClientCasesFromDb(
      [
        {
          id: 'consult-draft',
          status: 'IN_PROGRESS',
          createdAt,
          progressPercent: 30,
          extracted: { make: 'Toyota', model: 'Camry', symptoms: 'Стук' },
          serviceRequest: null,
        },
      ],
      [
        {
          id: 'req-1',
          status: 'NEW',
          createdAt,
          snapshotMake: 'BMW',
          snapshotModel: 'X5',
          snapshotSymptoms: 'Гул',
          consultationSessionId: 'consult-linked',
          consultationSession: { id: 'consult-linked', status: 'COMPLETED', flowState: {} },
        },
      ],
      [
        {
          id: 'booking-1',
          status: 'CONFIRMED',
          preferredAt: new Date('2026-07-10T10:00:00.000Z'),
          serviceRequest: { id: 'req-1', status: 'NEW' },
        },
      ],
    );

    expect(cases).toHaveLength(2);
    expect(cases.find((c) => c.id === 'req-1')?.bookingId).toBe('booking-1');
    expect(cases.find((c) => c.id === 'consult-draft')?.kind).toBe('draft');
  });
});
