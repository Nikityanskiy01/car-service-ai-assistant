import { describe, expect, it } from 'vitest';
import {
  filterCasesByTopic,
  resolveClientCaseTopic,
  sortClientCases,
} from './clientCaseTopic';
import type { ClientCase } from './types';

const baseCase: ClientCase = {
  id: 'case-1',
  kind: 'request',
  title: 'Toyota Camry',
  symptoms: 'Стук при торможении',
  status: 'IN_PROGRESS',
  requestStatus: 'IN_PROGRESS',
  progressStage: 'request',
  progressPercent: 55,
  progressLabel: 'В работе у мастера',
  lastActivityAt: '2026-07-02T10:00:00.000Z',
  topic: 'repair',
};

describe('clientCaseTopic', () => {
  it('detects maintenance from service symptoms', () => {
    expect(
      resolveClientCaseTopic({
        kind: 'draft',
        symptoms: 'Нужно плановое обслуживание и замена масла',
      }),
    ).toBe('maintenance');
  });

  it('detects diagnostics for draft without clear service markers', () => {
    expect(
      resolveClientCaseTopic({
        kind: 'draft',
        symptoms: 'Продолжите описание симптомов',
      }),
    ).toBe('diagnostics');
  });

  it('filters and sorts cases', () => {
    const cases: ClientCase[] = [
      { ...baseCase, id: 'a', topic: 'repair', lastActivityAt: '2026-07-01T10:00:00.000Z' },
      {
        ...baseCase,
        id: 'b',
        topic: 'maintenance',
        symptoms: 'Замена масла',
        lastActivityAt: '2026-07-03T10:00:00.000Z',
      },
    ];

    expect(filterCasesByTopic(cases, 'maintenance')).toHaveLength(1);
    expect(sortClientCases(cases, 'oldest')[0]?.id).toBe('a');
    expect(sortClientCases(cases, 'recent')[0]?.id).toBe('b');
  });
});
