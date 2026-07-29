import { describe, expect, it } from '@jest/globals';
import { buildAiFeedbackCsv, buildAiFeedbackReport } from '../../src/services/consultationFeedback.service.js';

function makeRow(overrides = {}) {
  return {
    id: 'fb-1',
    verdict: 'INCORRECT',
    actualCause: 'Износ подшипника ступицы',
    worksDone: 'Замена подшипника',
    createdAt: new Date('2026-07-01T10:00:00Z'),
    manager: { id: 'm1', fullName: 'Иван' },
    session: {
      extracted: { make: 'Toyota', model: 'Camry' },
      serviceCategory: { name: 'Подвеска' },
      caseEmbedding: null,
    },
    ...overrides,
  };
}

describe('consultationFeedback report', () => {
  it('computes accuracy and useful metrics', () => {
    const report = buildAiFeedbackReport(
      [
        makeRow({ verdict: 'CORRECT', actualCause: null }),
        makeRow({ id: 'fb-2', verdict: 'PARTIAL', actualCause: 'Трещина диска' }),
        makeRow({ id: 'fb-3', verdict: 'INCORRECT', actualCause: 'Износ подшипника ступицы' }),
      ],
      { days: 7 },
    );

    expect(report.totalFeedback).toBe(3);
    expect(report.accuracyPercent).toBe(33);
    expect(report.usefulPercent).toBe(67);
    expect(report.byVerdict).toEqual({ CORRECT: 1, PARTIAL: 1, INCORRECT: 1 });
    expect(report.topMisdiagnoses).toHaveLength(2);
    expect(report.topErrorCategories[0].category).toBe('Подвеска');
  });

  it('builds csv with headline metrics', () => {
    const report = buildAiFeedbackReport([makeRow()], { days: 14 });
    const csv = buildAiFeedbackCsv(report);
    expect(csv).toContain('accuracy_percent,0');
    expect(csv).toContain('period_days,14');
    expect(csv).toContain('verdict_incorrect,1');
  });
});
