import { describe, expect, it } from 'vitest';
import { parseObdCodesInput } from './obdCodes';

describe('obdCodes client', () => {
  it('parses input', () => {
    expect(parseObdCodesInput('p0300, P0420')).toEqual(['P0300', 'P0420']);
  });
});
