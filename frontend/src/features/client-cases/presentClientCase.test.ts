import { describe, expect, it } from 'vitest';
import { groupClientCases, presentClientCase } from './presentClientCase';
import type { ClientCase } from './types';

function makeCase(overrides: Partial<ClientCase> = {}): ClientCase {
  return {
    id: '1',
    kind: 'request',
    title: 'Toyota Camry',
    symptoms: 'Стук',
    status: 'NEW',
    requestStatus: 'NEW',
    progressStage: 'request',
    progressPercent: 40,
    progressLabel: 'Ждёт менеджера',
    lastActivityAt: '2026-07-02T10:00:00.000Z',
    topic: 'repair',
    ...overrides,
  };
}

describe('presentClientCase', () => {
  it('marks new requests as waiting with attention', () => {
    const presented = presentClientCase(makeCase());
    expect(presented.group).toBe('waiting');
    expect(presented.attention).toBe(true);
    expect(presented.statusLine).toBe('Ждём менеджера');
  });

  it('shows booking date for scheduled cases', () => {
    const presented = presentClientCase(
      makeCase({
        status: 'SCHEDULED',
        requestStatus: 'SCHEDULED',
        progressStage: 'booking',
        bookingPreferredAt: '2026-08-10T10:00:00.000Z',
      }),
    );
    expect(presented.group).toBe('scheduled');
    expect(presented.bookingParts).not.toBeNull();
    expect(presented.statusLine).toContain('Запись');
  });

  it('groups cases by stage', () => {
    const groups = groupClientCases([
      makeCase({ id: 'a', status: 'NEW', requestStatus: 'NEW' }),
      makeCase({
        id: 'b',
        status: 'IN_PROGRESS',
        requestStatus: 'IN_PROGRESS',
        progressStage: 'request',
      }),
      makeCase({
        id: 'c',
        status: 'SCHEDULED',
        requestStatus: 'SCHEDULED',
        bookingPreferredAt: '2026-08-10T10:00:00.000Z',
      }),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['waiting', 'working', 'scheduled']);
  });
});
