import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../src/lib/errors.js';
import {
  coerceDiagnosisLine,
  mergeDiagnosis,
  normalizeDiagnosisResult,
  preAnalyzeSymptoms,
  buildPlaybookFallbackDiagnosis,
  formatDiagnosisChatMessage,
} from '../../src/modules/consultations/consultationAi.service.js';
import { pickPlaybook } from '../../src/lib/diagnosticPlaybooks.js';

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

describe('ai-adapter — playbook fallback', () => {
  it('стук на кочках даёт полноценный разбор, а не «анализ недоступен»', () => {
    const payload = {
      car_make: 'Kia',
      car_model: 'Rio',
      symptoms: 'Стук спереди на кочках',
      conditions: 'город, мелкие неровности',
    };
    const pb = pickPlaybook(payload, payload.symptoms);
    expect(pb?.id).toBe('suspension-knock');
    const ruleBased = preAnalyzeSymptoms(payload);
    const out = buildPlaybookFallbackDiagnosis({
      reason: 'LLM_UNAVAILABLE',
      ruleBased,
      playbook: pb,
      payload,
      estimatedCost: 3000,
    });
    expect(out.status).toBe('SUCCESS');
    expect(out.analysis_available).toBe(true);
    expect(out.probable_causes.length).toBeGreaterThanOrEqual(2);
    expect(out.recommended_checks.length).toBeGreaterThanOrEqual(2);
    expect(String(out.summary).toLowerCase()).toMatch(/rio|подвеск|стук/);
  });

  it('плановое ТО не требует условий проявления', () => {
    const payload = { car_make: 'Hyundai', car_model: 'Solaris', symptoms: 'Плановое ТО 90 тыс.' };
    const pb = pickPlaybook(payload, payload.symptoms);
    expect(pb?.id).toBe('planned-maintenance');
    const out = buildPlaybookFallbackDiagnosis({
      reason: 'INSUFFICIENT_DATA',
      ruleBased: preAnalyzeSymptoms(payload),
      playbook: pb,
      payload,
    });
    expect(out.status).toBe('SUCCESS');
    expect(out.urgency).toBe('low');
    expect(out.probable_causes.join(' ').toLowerCase()).toMatch(/масл/);
  });
});

describe('ai-adapter — текст диагноза в чате', () => {
  it('formatDiagnosisChatMessage кладёт причины в ответ ассистента', () => {
    const text = formatDiagnosisChatMessage({
      summary: 'По Kia Rio ориентир — передняя подвеска.',
      probable_causes: ['Износ стойки амортизатора', 'Люфт опоры'],
      recommended_checks: ['Проверка люфта на подъёмнике'],
      analysis_available: true,
      status: 'SUCCESS',
    });
    expect(text).toContain('передняя подвеска');
    expect(text).toContain('Наиболее вероятные причины');
    expect(text).toContain('1. Износ стойки амортизатора');
    expect(text).toContain('Что проверим на посту');
  });
});
