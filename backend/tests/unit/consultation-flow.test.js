import { describe, expect, it } from '@jest/globals';
import {
  getMissingFields,
  getNextQuestion,
  preferPreExtractedServiceSymptoms,
  preExtractFromRules,
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
