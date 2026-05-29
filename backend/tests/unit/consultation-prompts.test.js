import { describe, expect, it } from '@jest/globals';
import {
  DIALOG_STEP_FORMAT_SCHEMA,
  DIALOG_STEP_SYSTEM_PROMPT,
  dialogStepUserPrompt,
} from '../../src/prompts/consultationPrompts.js';

describe('consultation prompts: dialog step contract', () => {
  it('экспортирует обязательные поля JSON-контракта для шага диалога', () => {
    expect(DIALOG_STEP_FORMAT_SCHEMA?.type).toBe('object');
    expect(Array.isArray(DIALOG_STEP_FORMAT_SCHEMA?.required)).toBe(true);
    expect(DIALOG_STEP_FORMAT_SCHEMA.required).toEqual(
      expect.arrayContaining(['intent', 'missing_fields', 'next_question', 'completion_ready', 'confidence']),
    );
  });

  it('формирует user prompt с контекстом истории и ранее заданных вопросов', () => {
    const prompt = dialogStepUserPrompt({
      userMessage: 'поменять тормозную жидкость',
      extracted: { car_make: 'Chevrolet', car_model: 'Cruze', mileage: 120000 },
      lastAssistantMessages: ['Опишите, пожалуйста, что требуется.'],
      askedQuestions: ['Опишите, пожалуйста, что требуется.'],
    });
    expect(prompt).toContain('Последняя реплика клиента');
    expect(prompt).toContain('Уже извлеченные поля');
    expect(prompt).toContain('Ранее заданные вопросы');
  });

  it('system prompt явно запрещает циклические вопросы', () => {
    expect(DIALOG_STEP_SYSTEM_PROMPT.toLowerCase()).toContain('не повторяй вопрос');
    expect(DIALOG_STEP_SYSTEM_PROMPT.toLowerCase()).toContain('ровно один короткий вопрос');
  });
});
