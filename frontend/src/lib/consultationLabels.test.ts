import { describe, expect, it } from 'vitest';
import { formatConsultationSubtitle, formatConsultationTitle } from './consultationLabels';

describe('consultationLabels', () => {
  it('formats title from vehicle and symptoms', () => {
    expect(
      formatConsultationTitle({
        id: 'abc12345-0000-0000-0000-000000000000',
        make: 'Toyota',
        model: 'Camry',
        symptoms: 'Стук при торможении',
      }),
    ).toBe('Toyota Camry — Стук при торможении');
  });

  it('falls back to session id', () => {
    expect(
      formatConsultationTitle({
        id: 'abc12345-0000-0000-0000-000000000000',
      }),
    ).toBe('Диагностика ABC12345');
  });

  it('formats subtitle by progress', () => {
    expect(formatConsultationSubtitle(100)).toBe('Анализ завершён');
    expect(formatConsultationSubtitle(40)).toBe('Прогресс: 40%');
    expect(formatConsultationSubtitle(null)).toBe('Диалог начат');
  });
});
