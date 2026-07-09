import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../src/lib/errors.js';
import {
  coerceDiagnosisLine,
  mergeDiagnosis,
  normalizeDiagnosisResult,
  preAnalyzeSymptoms,
} from '../../src/modules/consultations/consultationAi.service.js';

describe('ai-adapter — парсинг и нормализация ответа LLM', () => {
  it('coerceDiagnosisLine извлекает title из объекта', () => {
    expect(coerceDiagnosisLine({ title: 'Износ тормозных дисков' })).toBe('Износ тормозных дисков');
    expect(coerceDiagnosisLine('[object Object]')).toBe('');
  });

  it('normalizeDiagnosisResult ограничивает confidence и заполняет fallback', () => {
    const out = normalizeDiagnosisResult({
      probable_causes: [],
      recommended_checks: [],
      confidence: 2,
      urgency: 'invalid',
      summary: '',
    });
    expect(out.confidence).toBeLessThanOrEqual(1);
    expect(out.probable_causes.length).toBe(0);
    expect(['low', 'medium', 'high', 'critical']).toContain(out.urgency);
  });

  it('mergeDiagnosis объединяет rule-based и LLM без дублей', () => {
    const ruleBased = preAnalyzeSymptoms({
      symptoms: 'биение руля',
      conditions: 'при торможении',
    });
    const llm = {
      probable_causes: ['Деформация тормозных дисков', 'Прочее'],
      recommended_checks: ['Осмотр'],
      urgency: 'medium',
      confidence: 0.5,
      estimated_cost_from: 5000,
      summary: 'По симптомам вероятна проблема тормозной системы при торможении.',
    };
    const merged = mergeDiagnosis(ruleBased, llm);
    expect(merged.probable_causes.length).toBeGreaterThan(0);
    expect(merged.probable_causes.length).toBeLessThanOrEqual(5);
    expect(merged.confidence).toBeGreaterThan(0.4);
    expect(merged.estimated_cost_from).toBe(5000);
  });

  it('невалидный JSON после LLM → merge с fallback (симуляция FR-025b)', () => {
    const ruleBased = preAnalyzeSymptoms({
      symptoms: 'стук',
      conditions: 'на неровной дороге',
    });
    let parsed;
    try {
      parsed = JSON.parse('{ not json');
    } catch {
      parsed = null;
    }
    expect(parsed).toBeNull();
    const fallback = mergeDiagnosis(ruleBased, {
      probable_causes: ['Требуется очная проверка'],
      recommended_checks: ['Диагностика в сервисе'],
      urgency: 'low',
      confidence: 0.35,
      estimated_cost_from: null,
      summary: 'По текущим данным невозможно сделать надежный вывод.',
    });
    expect(Array.isArray(fallback.recommended_checks)).toBe(true);
  });

  it('manual-review статус не маскируется под успешный анализ', () => {
    const out = normalizeDiagnosisResult({
      status: 'MANUAL_REVIEW_REQUIRED',
      analysis_available: false,
      reason: 'LLM_UNAVAILABLE',
    });
    expect(out.status).toBe('MANUAL_REVIEW_REQUIRED');
    expect(out.analysis_available).toBe(false);
    expect(out.probable_causes).toEqual([]);
  });
});

describe('ai-adapter — код ошибки LLM (FR-025b)', () => {
  it('AppError LLM_ERROR имеет статус 503', () => {
    const err = new AppError(503, 'LLM unavailable', 'LLM_ERROR');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('LLM_ERROR');
  });
});
