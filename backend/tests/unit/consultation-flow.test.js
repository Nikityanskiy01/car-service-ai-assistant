import { describe, expect, it } from '@jest/globals';
import {
  countFieldsChangedByPre,
  detectSymptomCategory,
  getMissingFields,
  getNextQuestion,
  isSimpleExtractionMessage,
  preferPreExtractedServiceSymptoms,
  preExtractFromRules,
  shouldSkipLlmExtraction,
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

describe('shouldSkipLlmExtraction', () => {
  it('пропускает короткий пробег и «всегда»', () => {
    expect(isSimpleExtractionMessage('120000')).toBe(true);
    expect(isSimpleExtractionMessage('всегда')).toBe(true);
    expect(shouldSkipLlmExtraction('120000', {}, { mileage: 120000 })).toBe(true);
  });

  it('пропускает, если правила извлекли ≥2 поля из одного сообщения', () => {
    const base = {};
    const pre = preExtractFromRules('BMW X5 140000 стук при торможении', base);
    expect(countFieldsChangedByPre(base, pre)).toBeGreaterThanOrEqual(2);
    expect(shouldSkipLlmExtraction('BMW X5 140000 стук при торможении', base, pre)).toBe(true);
  });

  it('не пропускает длинное сообщение без срабатывания правил', () => {
    const base = {};
    const pre = preExtractFromRules(
      'У меня странная ситуация с машиной, иногда что-то происходит но непонятно когда именно',
      base,
    );
    expect(countFieldsChangedByPre(base, pre)).toBe(0);
    expect(
      shouldSkipLlmExtraction(
        'У меня странная ситуация с машиной, иногда что-то происходит но непонятно когда именно',
        base,
        pre,
      ),
    ).toBe(false);
  });

  it('модель одним словом при известной марке', () => {
    const base = { car_make: 'Toyota' };
    const pre = preExtractFromRules('Camry', base);
    expect(pre.car_model).toBe('Camry');
    expect(shouldSkipLlmExtraction('Camry', base, pre)).toBe(true);
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

describe('mileage/year extraction regression', () => {
  it('Skoda Octavia 2020 -> year only, mileage null', () => {
    const out = preExtractFromRules('Skoda Octavia 2020', {});
    expect(out.car_make).toBe('Skoda');
    expect(out.car_model).toBe('Octavia');
    expect(out.year).toBe(2020);
    expect(out.mileage).toBeNull();
  });

  it('Skoda Octavia 2020, пробег 130000 км -> parse both year and mileage', () => {
    const out = preExtractFromRules('Skoda Octavia 2020, пробег 130000 км', {});
    expect(out.year).toBe(2020);
    expect(out.mileage).toBe(130000);
  });

  it('Skoda Octavia, пробег 2020 км -> mileage set, year not hallucinated', () => {
    const out = preExtractFromRules('Skoda Octavia, пробег 2020 км', {});
    expect(out.mileage).toBe(2020);
    expect(out.year).toBeNull();
  });

  it('Пробег около 120 тыс. км -> 120000', () => {
    const out = preExtractFromRules('Пробег около 120 тыс. км', {});
    expect(out.mileage).toBe(120000);
  });

  it('2020 км после ремонта -> do not auto-treat as odometer mileage', () => {
    const out = preExtractFromRules('2020 км после ремонта', {});
    expect(out.mileage).toBeNull();
  });

  it('year correction keeps latest value', () => {
    const initial = preExtractFromRules('Skoda Octavia 2019', {});
    const corrected = preExtractFromRules('ошибся, 2020', initial);
    expect(corrected.year).toBe(2020);
  });

  it('unstable idle rpm keeps engine context and requests mileage', () => {
    const out = preExtractFromRules('Нестабильные обороты на холостом ходу', {});
    expect(detectSymptomCategory(String(out.symptoms || ''))).toBe('engine');
    const missing = getMissingFields({
      car_make: 'Skoda',
      car_model: 'Octavia',
      symptoms: out.symptoms,
      conditions: out.conditions,
      mileage: null,
    });
    expect(missing).toContain('mileage');
  });
});
