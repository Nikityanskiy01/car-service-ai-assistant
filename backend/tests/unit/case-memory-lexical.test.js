import { describe, expect, it } from '@jest/globals';
import { getRelevantCases, getRelevantCasesLexical, getRelevantCasesSemantic } from '../../src/services/caseMemory.service.js';

describe('caseMemory exports', () => {
  it('exports hybrid and retrieval helpers', () => {
    expect(typeof getRelevantCases).toBe('function');
    expect(typeof getRelevantCasesLexical).toBe('function');
    expect(typeof getRelevantCasesSemantic).toBe('function');
  });
});
