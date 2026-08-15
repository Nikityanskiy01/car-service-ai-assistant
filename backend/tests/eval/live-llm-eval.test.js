import { describe, expect, it } from '@jest/globals';
import {
  parseLlmJson,
  resolveLiveEvalMode,
  scoreLiveExtraction,
  summarizeLiveEval,
} from '../../src/modules/eval/liveLlmEval.js';

describe('live LLM eval scoring', () => {
  it('passes a complete extraction', () => {
    const scored = scoreLiveExtraction(
      {
        car_make: 'Toyota',
        car_model: 'Camry',
        year: 2018,
        mileage: 120000,
        symptoms: 'биение руля при торможении',
      },
      {
        makeIncludes: 'toyota',
        modelIncludes: 'camry',
        year: 2018,
        mileageMin: 100000,
        symptomsIncludes: ['тормож'],
      },
    );
    expect(scored.ok).toBe(true);
    expect(scored.issues).toEqual([]);
  });

  it('accepts any of several make aliases', () => {
    const scored = scoreLiveExtraction(
      { car_make: 'Lada', symptoms: 'перегрев' },
      { makeIncludes: ['lada', 'ваз', 'лада'], symptomsIncludes: ['перегрев'] },
    );
    expect(scored.ok).toBe(true);
  });

  it('fails missing year and mileage', () => {
    const scored = scoreLiveExtraction(
      { car_make: 'Toyota', car_model: 'Camry', symptoms: 'торможение' },
      { makeIncludes: 'toyota', year: 2018, mileageMin: 100000 },
    );
    expect(scored.ok).toBe(false);
    expect(scored.issues.some((i) => i.startsWith('year'))).toBe(true);
    expect(scored.issues.some((i) => i.startsWith('mileage'))).toBe(true);
  });

  it('parses fenced JSON from the model', () => {
    const parsed = parseLlmJson('```json\n{"car_make":"Kia","car_model":"Rio"}\n```');
    expect(parsed.car_make).toBe('Kia');
  });

  it('summarizes with min pass ratio', () => {
    const report = summarizeLiveEval(
      [
        { id: 'a', ok: true, issues: [] },
        { id: 'b', ok: true, issues: [] },
        { id: 'c', ok: false, issues: ['x'] },
      ],
      0.8,
    );
    expect(report.ok).toBe(false);
    expect(report.passed).toBe(2);
    expect(summarizeLiveEval(report.cases, 0.6).ok).toBe(true);
  });

  it('skips when LLM is off unless required', () => {
    expect(resolveLiveEvalMode({ llmEnabled: false, required: false })).toBe('skip');
    expect(resolveLiveEvalMode({ llmEnabled: false, required: true })).toBe('run');
    expect(
      resolveLiveEvalMode({ llmEnabled: true, provider: 'openai', apiKey: '', required: false }),
    ).toBe('skip');
    expect(
      resolveLiveEvalMode({ llmEnabled: true, provider: 'openai', apiKey: 'sk-test', required: false }),
    ).toBe('run');
  });
});
