import { z } from 'zod';

const HAS_LATIN_LETTER = /[A-Za-z]/;
const HAS_CYRILLIC = /[А-Яа-яЁё]/;
const HAS_DIGIT = /\d/;

export const PASSWORD_POLICY_MESSAGE =
  'Пароль: не менее 8 символов, латинские буквы и цифры; кириллица не допускается';

/**
 * @param {string} value
 */
export function passwordMeetsPolicy(value) {
  const s = String(value || '');
  if (s.length < 8) return false;
  if (HAS_CYRILLIC.test(s)) return false;
  if (!HAS_LATIN_LETTER.test(s)) return false;
  if (!HAS_DIGIT.test(s)) return false;
  return true;
}

/** Схема пароля при регистрации (и при смене пароля, если появится). */
export const registerPasswordSchema = z.string().superRefine((val, ctx) => {
  if (!passwordMeetsPolicy(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: PASSWORD_POLICY_MESSAGE,
    });
  }
});
