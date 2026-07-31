import { describe, expect, it } from 'vitest';
import {
  countNationalDigitsBefore,
  extractNationalDigits,
  formatPhoneDisplay,
  formatPhoneInput,
  nationalDigitIndexToCursor,
} from './formatPhone';

describe('formatPhone', () => {
  it('extracts national digits without duplicating country code', () => {
    expect(extractNationalDigits('+7 (999) 000-00-00')).toBe('9990000000');
    expect(extractNationalDigits('+7 (7')).toBe('7');
    expect(extractNationalDigits('+7 (')).toBe('');
    expect(extractNationalDigits('7')).toBe('');
    expect(extractNationalDigits('89990000000')).toBe('9990000000');
    expect(extractNationalDigits('9990000000')).toBe('9990000000');
  });

  it('formats progressively while typing', () => {
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay('9')).toBe('+7 (9');
    expect(formatPhoneDisplay('999')).toBe('+7 (999');
    expect(formatPhoneDisplay('999000')).toBe('+7 (999) 000');
    expect(formatPhoneDisplay('9990000000')).toBe('+7 (999) 000-00-00');
  });

  it('allows clearing the field', () => {
    expect(formatPhoneInput('')).toBe('');
    expect(formatPhoneInput('+7 (')).toBe('');
    expect(formatPhoneInput('+7 (9')).toBe('+7 (9');
  });

  it('deletes last digit without restoring country code twice', () => {
    expect(formatPhoneInput('+7 (9')).toBe('+7 (9');
    expect(formatPhoneInput('+7 (')).toBe('');
    expect(formatPhoneInput('+7 (99')).toBe('+7 (99');
    expect(formatPhoneInput('+7 (9')).toBe('+7 (9');
  });

  it('keeps cursor mapping stable', () => {
    const formatted = '+7 (999) 000-00-00';
    expect(countNationalDigitsBefore(formatted, 5)).toBe(1);
    expect(nationalDigitIndexToCursor(1, formatted)).toBe(5);
    expect(nationalDigitIndexToCursor(0, '+7 (9')).toBe(4);
  });
});
