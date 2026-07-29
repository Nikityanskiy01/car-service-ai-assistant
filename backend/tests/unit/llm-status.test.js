import { describe, expect, it } from '@jest/globals';
import { deriveLlmHealthState, resolveLlmModels } from '../../src/services/llmStatus.service.js';

describe('llmStatus.service', () => {
  it('resolveLlmModels falls back to main model', () => {
    const models = resolveLlmModels({
      LLM_MODEL: 'qwen2.5:7b',
      LLM_EXTRACTION_MODEL: '',
      LLM_DIAGNOSIS_MODEL: 'qwen2.5:14b',
      LLM_EMBEDDING_MODEL: 'nomic-embed-text',
    });
    expect(models).toEqual({
      main: 'qwen2.5:7b',
      extraction: 'qwen2.5:7b',
      diagnosis: 'qwen2.5:14b',
      embedding: 'nomic-embed-text',
    });
  });

  it('deriveLlmHealthState reflects disabled and fallback', () => {
    expect(deriveLlmHealthState({ LLM_ENABLED: false, LLM_FALLBACK_ENABLED: false })).toBe('disabled');
    expect(deriveLlmHealthState({ LLM_ENABLED: true, LLM_FALLBACK_ENABLED: true })).toBe('degraded');
    expect(deriveLlmHealthState({ LLM_ENABLED: true, LLM_FALLBACK_ENABLED: false })).toBe('ok');
  });
});
