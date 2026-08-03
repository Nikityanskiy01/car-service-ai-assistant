import { describe, expect, it } from 'vitest';
import {
  getEmailError,
  getFullNameError,
  getPasswordConfirmError,
  getPasswordError,
  getPhoneError,
  isValidPhoneDigits,
  normalizePhoneDigits,
  passwordMeetsPolicy,
} from './validation';

describe('normalizePhoneDigits', () => {
  it('normalizes Russian numbers', () => {
    expect(normalizePhoneDigits('+7 (999) 000-00-00')).toBe('79990000000');
    expect(normalizePhoneDigits('89990000000')).toBe('79990000000');
    expect(normalizePhoneDigits('9990000000')).toBe('79990000000');
  });
});

describe('isValidPhoneDigits', () => {
  it('accepts valid RU and international numbers', () => {
    expect(isValidPhoneDigits('79990000000')).toBe(true);
    expect(isValidPhoneDigits('12025550123')).toBe(true);
  });

  it('rejects too short numbers', () => {
    expect(isValidPhoneDigits('7999000')).toBe(false);
  });
});

describe('getPhoneError', () => {
  it('returns null for valid phone', () => {
    expect(getPhoneError('+7 (999) 000-00-00')).toBeNull();
  });

  it('returns error for invalid phone', () => {
    expect(getPhoneError('123')).toBeTruthy();
  });
});

describe('getEmailError', () => {
  it('validates required email', () => {
    expect(getEmailError('client@example.com')).toBeNull();
    expect(getEmailError('bad')).toBeTruthy();
    expect(getEmailError('')).toBeTruthy();
  });

  it('allows empty optional email', () => {
    expect(getEmailError('', { required: false })).toBeNull();
    expect(getEmailError('bad@', { required: false })).toBeTruthy();
  });
});

describe('getFullNameError', () => {
  it('requires at least 2 characters', () => {
    expect(getFullNameError('Иван')).toBeNull();
    expect(getFullNameError('А')).toBeTruthy();
    expect(getFullNameError('')).toBeTruthy();
  });
});

describe('getPasswordError', () => {
  it('enforces password policy', () => {
    expect(getPasswordError('Password123!ab')).toBeNull();
    expect(getPasswordError('short')).toBeTruthy();
    expect(passwordMeetsPolicy('Пароль123!ab')).toBe(false);
  });
});

describe('getPasswordConfirmError', () => {
  it('requires matching passwords', () => {
    expect(getPasswordConfirmError('Password123!ab', 'Password123!ab')).toBeNull();
    expect(getPasswordConfirmError('Password123!ab', '')).toBeTruthy();
    expect(getPasswordConfirmError('Password123!ab', 'other')).toBe('Пароли не совпадают');
  });
});
