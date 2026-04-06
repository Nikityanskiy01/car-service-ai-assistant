import { passwordMeetsPolicy, PASSWORD_POLICY_MESSAGE } from '../../src/lib/passwordPolicy.js';

describe('passwordPolicy', () => {
  it('accepts 8+ chars with Latin letter and digit', () => {
    expect(passwordMeetsPolicy('password123')).toBe(true);
    expect(passwordMeetsPolicy('abc12345')).toBe(true);
  });

  it('rejects Cyrillic in password', () => {
    expect(passwordMeetsPolicy('Пароль99')).toBe(false);
    expect(passwordMeetsPolicy('pass123кириллица')).toBe(false);
  });

  it('rejects too short', () => {
    expect(passwordMeetsPolicy('ab1')).toBe(false);
    expect(passwordMeetsPolicy('1234567')).toBe(false);
  });

  it('rejects without digit', () => {
    expect(passwordMeetsPolicy('abcdefgh')).toBe(false);
  });

  it('rejects without letter', () => {
    expect(passwordMeetsPolicy('12345678')).toBe(false);
  });

  it('exports Russian policy message', () => {
    expect(PASSWORD_POLICY_MESSAGE).toContain('8');
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/цифр/i);
  });
});
