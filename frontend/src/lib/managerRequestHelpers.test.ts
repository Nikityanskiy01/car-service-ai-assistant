import { describe, expect, it } from 'vitest';
import { formatExtractedFields, formatMileageKm } from './managerRequestHelpers';

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
