import { describe, expect, it } from '@jest/globals';
import { lookupObdCodes, formatObdForPrompt } from '../../src/lib/obdCodeCatalog.js';
import { parseObdCodes, mergeObdCodesString } from '../../src/lib/obdCodes.js';

describe('obdCodes', () => {
  it('parses multiple codes from text', () => {
    expect(parseObdCodes('горит check, коды P0300 и p0420')).toEqual(['P0300', 'P0420']);
  });

  it('merges codes uniquely', () => {
    expect(mergeObdCodesString('P0300', 'p0420, P0300')).toBe('P0300, P0420');
  });

  it('lookup returns plain language', () => {
    const rows = lookupObdCodes(['P0300']);
    expect(rows[0].code).toBe('P0300');
    expect(rows[0].plain.length).toBeGreaterThan(10);
  });

  it('formatObdForPrompt is non-empty', () => {
    const text = formatObdForPrompt(['P0420']);
    expect(text).toContain('P0420');
  });
});
