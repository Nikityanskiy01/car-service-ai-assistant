import { describe, expect, it } from 'vitest';
import { buildRequestHistoryEvents, formatExtractedFields, formatMileageKm, formatRuEventCount } from './managerRequestHelpers';

describe('formatExtractedFields', () => {
  it('hides technical keys such as sessionId', () => {
    const fields = formatExtractedFields({
      sessionId: 'bd458d25-0aa1-47f5-afa5-e26edfc88c86',
      id: 'should-hide',
      make: 'Skoda',
      model: 'Octavia',
      year: 2016,
      mileage: 154000,
      symptoms: 'Рывки АКПП на 2-3',
      problemConditions: 'Городской цикл, прогретая коробка',
      unknownDump: 'raw',
    });

    expect(fields.map((field) => field.key)).toEqual([
      'make',
      'model',
      'year',
      'mileage',
      'symptoms',
      'problemConditions',
    ]);
    expect(fields.find((field) => field.key === 'mileage')?.value).toMatch(/154[\s\u00a0]000 км/);
  });

  it('omits fields already shown elsewhere on the request card', () => {
    const fields = formatExtractedFields(
      {
        make: 'Skoda',
        problemConditions: 'Городской цикл, прогретая коробка',
        obdCodes: 'P0741',
      },
      { omit: ['make', 'model', 'year', 'mileage', 'symptoms'] },
    );

    expect(fields.map((field) => field.key)).toEqual(['problemConditions', 'obdCodes']);
  });
});

describe('formatMileageKm', () => {
  it('formats a numeric mileage with grouping', () => {
    expect(formatMileageKm(154000)).toMatch(/154[\s\u00a0]000 км/);
  });
});

describe('formatRuEventCount', () => {
  it('picks the Russian plural form', () => {
    expect(formatRuEventCount(1)).toBe('1 событие');
    expect(formatRuEventCount(2)).toBe('2 события');
    expect(formatRuEventCount(5)).toBe('5 событий');
    expect(formatRuEventCount(11)).toBe('11 событий');
    expect(formatRuEventCount(21)).toBe('21 событие');
  });
});

describe('buildRequestHistoryEvents', () => {
  it('sorts events newest first and labels message authors', () => {
    const events = buildRequestHistoryEvents({
      createdAt: '2026-08-16T16:00:00.000Z',
      statusHistory: [
        {
          id: 'st-1',
          fromStatus: 'NEW',
          toStatus: 'IN_PROGRESS',
          createdAt: '2026-08-16T16:10:00.000Z',
          actor: { fullName: 'Иван Петров' },
        },
      ],
      messages: [
        {
          id: 'm-1',
          createdAt: '2026-08-16T16:12:00.000Z',
          author: { fullName: 'Клиент', role: 'CLIENT' },
        },
      ],
      feedbackUpdatedAt: '2026-08-16T16:20:00.000Z',
      succeededJobs: [{ id: 'job-1', updatedAt: '2026-08-16T16:30:00.000Z' }],
    });

    expect(events.map((event) => event.kind)).toEqual([
      'crm',
      'feedback',
      'message',
      'status',
      'created',
    ]);
    expect(events.find((event) => event.kind === 'message')?.title).toBe('Сообщение от клиента');
    expect(events.find((event) => event.kind === 'status')?.title).toBe('Статус: В работе');
    expect(events.find((event) => event.kind === 'status')?.detail).toContain('было Новая');
  });
});
