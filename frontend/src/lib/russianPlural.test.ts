import { describe, expect, it } from 'vitest';
import { formatActiveCasesLabel, formatTotalCasesLabel, formatVehicleCasesLabel } from './russianPlural';

describe('russianPlural', () => {
  it('formats active cases with correct grammar', () => {
    expect(formatActiveCasesLabel(1)).toBe('1 активная заявка');
    expect(formatActiveCasesLabel(2)).toBe('2 активные заявки');
    expect(formatActiveCasesLabel(5)).toBe('5 активных заявок');
    expect(formatActiveCasesLabel(21)).toBe('21 активная заявка');
  });

  it('formats total cases with correct grammar', () => {
    expect(formatTotalCasesLabel(1)).toBe('1 обращение');
    expect(formatTotalCasesLabel(3)).toBe('3 обращения');
    expect(formatTotalCasesLabel(11)).toBe('11 обращений');
  });

  it('prefers active count for vehicle label', () => {
    expect(formatVehicleCasesLabel({ activeCasesCount: 1, totalCasesCount: 4 })).toBe('1 активная заявка');
    expect(formatVehicleCasesLabel({ activeCasesCount: 0, totalCasesCount: 2 })).toBe('2 обращения');
    expect(formatVehicleCasesLabel({})).toBe('Нет обращений');
  });
});
