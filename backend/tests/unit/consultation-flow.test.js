import { describe, expect, it } from '@jest/globals';
import {
  getMissingFields,
  getNextQuestion,
  preferPreExtractedServiceSymptoms,
  preExtractFromRules,
  tryExtractUniversalConditionAnswer,
} from '../../src/services/consultationFlowService.js';

describe('preExtractFromRules — плановые работы', () => {
  it('заполняет symptoms для «замена масла» без паттернов «стук/троит»', () => {
    const base = {
      car_make: 'BMW',
      car_model: 'X5',
      mileage: 140000,
    };
    const out = preExtractFromRules('Замена масла двс', base);
    expect(out.symptoms).toBeTruthy();
    expect(String(out.symptoms).toLowerCase()).toContain('масл');
  });

  it('после извлечения нет missing symptoms для service — следующий шаг не «опишите запрос»', () => {
    const merged = {
      car_make: 'BMW',
      car_model: 'X5',
      mileage: 140000,
      symptoms: 'замена масла двс',
      conditions: null,
    };
    expect(getMissingFields(merged)).toEqual([]);
    expect(getNextQuestion(merged)).toBeNull();
  });
});

describe('tryExtractUniversalConditionAnswer / условия проявления', () => {
  it('принимает «всегда» и always при симптомах, не относящихся к плановому ТО', () => {
    const base = { symptoms: 'вода в топливном баке' };
    expect(tryExtractUniversalConditionAnswer('всегда', base)).toBe('постоянно, в любых условиях');
    expect(tryExtractUniversalConditionAnswer('always', base)).toBe('постоянно, в любых условиях');
  });

  it('не подставляет условия без симптомов или для планового ТО', () => {
    expect(tryExtractUniversalConditionAnswer('всегда', { symptoms: null })).toBeNull();
    expect(tryExtractUniversalConditionAnswer('всегда', { symptoms: 'замена масла' })).toBeNull();
    expect(tryExtractUniversalConditionAnswer('всегда', { symptoms: 'вода в баке' })).toBeTruthy();
  });

  it('preExtractFromRules заполняет conditions из «всегда»', () => {
    const base = {
      car_make: 'Mazda',
      car_model: '3',
      mileage: 44000,
      symptoms: 'вода в баке',
    };
    const out = preExtractFromRules('всегда', base);
    expect(out.conditions).toBe('постоянно, в любых условиях');
  });

  it('preExtractFromRules: на выключенном моторе даёт условия', () => {
    const base = {
      car_make: 'Mazda',
      car_model: '3',
      mileage: 44000,
      symptoms: 'вода в баке',
    };
    const out = preExtractFromRules('на выключенном моторе', base);
    expect(out.conditions).toBeTruthy();
  });
});

describe('preferPreExtractedServiceSymptoms', () => {
  it('восстанавливает полную фразу, если LLM оставил только «ДВС»', () => {
    const pre = { symptoms: 'замена масла ДВС' };
    const merged = { symptoms: 'ДВС', car_make: 'BMW' };
    const out = preferPreExtractedServiceSymptoms(pre, merged);
    expect(out.symptoms).toBe('замена масла ДВС');
  });

  it('не затирает уточнённый ответ LLM, если он всё ещё про плановое ТО', () => {
    const pre = { symptoms: 'замена масла ДВС' };
    const merged = { symptoms: 'замена масла и фильтра' };
    const out = preferPreExtractedServiceSymptoms(pre, merged);
    expect(out.symptoms).toBe('замена масла и фильтра');
  });
});
