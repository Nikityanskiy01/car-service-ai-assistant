import { passwordMeetsPolicy, PASSWORD_POLICY_MESSAGE } from '../../src/lib/passwordPolicy.js';

describe('password policy', () => {
  it('accepts strong latin passwords', () => {
    expect(passwordMeetsPolicy('Password123!ab')).toBe(true);
    expect(passwordMeetsPolicy('Str0ng!Pass#99')).toBe(true);
  });

  it('rejects cyrillic', () => {
    expect(passwordMeetsPolicy('Пароль99Ab!x')).toBe(false);
    expect(passwordMeetsPolicy('Pass123!кириллица')).toBe(false);
  });

  it('rejects short / weak', () => {
    expect(passwordMeetsPolicy('Ab1!')).toBe(false);
    expect(passwordMeetsPolicy('password123')).toBe(false);
    expect(passwordMeetsPolicy('Password1234')).toBe(false); // no special
    expect(passwordMeetsPolicy('PASSWORD123!')).toBe(false); // no lower
    expect(passwordMeetsPolicy('password123!')).toBe(false); // no upper
  });

  it('exposes message', () => {
    expect(PASSWORD_POLICY_MESSAGE).toMatch(/12/);
  });
});
