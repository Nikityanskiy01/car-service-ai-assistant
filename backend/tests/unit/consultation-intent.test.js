import { describe, expect, it } from '@jest/globals';
import { detectConsultationIntent, detectServiceType } from '../../src/services/consultationIntent.service.js';

describe('consultationIntent', () => {
  it('классифицирует плановый запрос с маслом и фильтром как service', () => {
    const msg = 'просто поменять масло в двс и фильтр';
    expect(detectConsultationIntent(msg)).toBe('service');
    expect(detectServiceType(msg)).toBe('oil_change');
  });

  it('не ломает диагностический приоритет при симптомах', () => {
    const msg = 'замена масла и стук при торможении';
    expect(detectConsultationIntent(msg)).toBe('diagnostic');
  });
});
