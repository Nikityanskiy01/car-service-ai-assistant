import { z } from 'zod';

const HAS_UPPER = /[A-Z]/
const HAS_LOWER = /[a-z]/
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/
const HAS_CYRILLIC = /[А-Яа-яЁё]/

export const PASSWORD_POLICY_MESSAGE =
  'Пароль: минимум 12 символов, латиница (A–Z и a–z), цифра и спецсимвол; кириллица не допускается';

/**
 * @param {string} value
 */
export function passwordMeetsPolicy(value) {
  const s = String(value || '');
  if (s.length < 12) return false;
  if (HAS_CYRILLIC.test(s)) return false;
  if (!HAS_UPPER.test(s)) return false;
  if (!HAS_LOWER.test(s)) return false;
  if (!HAS_DIGIT.test(s)) return false;
  if (!HAS_SPECIAL.test(s)) return false;
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
