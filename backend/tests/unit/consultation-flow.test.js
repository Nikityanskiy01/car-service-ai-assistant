import { describe, expect, it } from '@jest/globals';
import {
  countFieldsChangedByPre,
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

  it('корректно извлекает модель с запятой в сообщении "Mazda 3, 32333, ..."', () => {
    const out = preExtractFromRules('Мазда 3, 32333, греется двигатель', {});
    expect(out.car_make).toBe('Mazda');
    expect(out.car_model).toBe('3');
    expect(out.mileage).toBe(32333);
    expect(String(out.symptoms || '').toLowerCase()).toContain('гре');
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

  it('модель одним словом с пунктуацией при известной марке', () => {
    const base = { car_make: 'Mazda' };
    const pre = preExtractFromRules('3,', base);
    expect(pre.car_model).toBe('3');
    expect(shouldSkipLlmExtraction('3,', base, pre)).toBe(true);
  });

  it('не принимает служебное слово как модель в "Мазда, пробег 120000"', () => {
    const pre = preExtractFromRules('Мазда, пробег 120000', {});
    expect(pre.car_make).toBe('Mazda');
    expect(pre.car_model).toBeNull();
    expect(pre.mileage).toBe(120000);
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
