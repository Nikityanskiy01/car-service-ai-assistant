import { describe, expect, it } from '@jest/globals';
import { isServiceHistoryQuestion } from '../../src/services/serviceHistoryLookup.service.js';

describe('serviceHistoryLookup intent', () => {
  it('detects oil history questions', () => {
    expect(isServiceHistoryQuestion('когда я менял масло?')).toBe(true);
    expect(isServiceHistoryQuestion('Пора ли менять масло')).toBe(true);
    expect(isServiceHistoryQuestion('когда следующая замена масла')).toBe(true);
  });

  it('ignores unrelated messages', () => {
    expect(isServiceHistoryQuestion('стук в подвеске на кочках')).toBe(false);
    expect(isServiceHistoryQuestion('замена масла')).toBe(false);
  });
});
