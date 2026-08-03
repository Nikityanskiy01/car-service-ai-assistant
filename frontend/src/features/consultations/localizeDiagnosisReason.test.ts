import { describe, expect, it } from 'vitest';
import { formatManualReviewHint, localizeDiagnosisReason } from './localizeDiagnosisReason';

describe('localizeDiagnosisReason', () => {
  it('переводит известные коды', () => {
    expect(localizeDiagnosisReason('INSUFFICIENT_DATA')).toMatch(/недостаточно данных/i);
    expect(localizeDiagnosisReason('LLM_UNAVAILABLE')).toMatch(/недоступен/i);
  });

  it('скрывает неизвестные коды', () => {
    expect(localizeDiagnosisReason('SOME_INTERNAL_CODE')).toBeNull();
  });

  it('формирует подсказку для карточки', () => {
    expect(formatManualReviewHint('INSUFFICIENT_DATA')).toMatch(/^Недостаточно данных/);
    expect(formatManualReviewHint('UNKNOWN')).toMatch(/Менеджер проверит/);
  });
});
