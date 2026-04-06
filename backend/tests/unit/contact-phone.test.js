import { isValidPhoneDigits, normalizePhone } from '../../src/modules/contact/contact.service.js';

describe('contact phone', () => {
  it('normalizes 8 and 10-digit input', () => {
    expect(normalizePhone('8 (999) 000-11-22')).toBe('79990001122');
    expect(normalizePhone('9990001122')).toBe('79990001122');
    expect(normalizePhone('+7 999 000 11 22')).toBe('79990001122');
  });

  it('validates RU and international lengths', () => {
    expect(isValidPhoneDigits('79990001122')).toBe(true);
    expect(isValidPhoneDigits('799900011')).toBe(false);
    expect(isValidPhoneDigits('1234567890')).toBe(true);
  });
});
