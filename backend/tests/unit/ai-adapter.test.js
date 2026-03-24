import { normalizeLlmPayload, parseLlmJson } from '../../src/modules/ai/parseResponse.js';
import { mockLlmTurn } from '../../src/modules/ai/llm.js';

describe('ai parse', () => {
  it('parseLlmJson strips fences', () => {
    const j = parseLlmJson('```json\n{"reply":"hi","extracted":{}}\n```');
    expect(j.reply).toBe('hi');
  });

  it('normalizeLlmPayload defaults', () => {
    const n = normalizeLlmPayload({ reply: 'ok', extracted: {}, recommendations: [] });
    expect(n.reply).toBe('ok');
    expect(n.recommendations).toEqual([]);
  });
});

describe('mock LLM FR-025b path', () => {
  it('returns structured payload', () => {
    const session = {
      extracted: {},
      messages: [],
    };
    const out = mockLlmTurn(session, 'hello');
    expect(out.reply).toBeTruthy();
    expect(out.extracted).toBeTruthy();
  });
});
