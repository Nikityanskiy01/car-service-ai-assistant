/** Сообщения об ошибках (синхронизированы с backend). */
export const VALIDATION_MESSAGES = {
  phone: 'Укажите корректный номер телефона, например +7 (999) 000-00-00',
  email: 'Укажите корректный email, например client@example.com',
  fullName: 'Укажите имя (минимум 2 символа)',
  password:
    'Пароль: минимум 12 символов, латиница (A–Z и a–z), цифра и спецсимвол; кириллица не допускается',
} as const;

/** Нормализация телефона: только цифры, 8→7, 10 цифр → +7… */
export function normalizePhoneDigits(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d[0] === '8') d = `7${d.slice(1)}`;
  if (d.length === 10) d = `7${d}`;
  return d;
}

/** РФ 7XXXXXXXXXX (11 цифр) или международный 10–15 цифр. */
export function isValidPhoneDigits(digits: string): boolean {
  if (!digits || digits.length < 10 || digits.length > 15) return false;
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length === 11 && digits[0] === '7') return true;
  return digits.length >= 10 && digits.length <= 15;
}

export function getPhoneError(raw: string): string | null {
  const digits = normalizePhoneDigits(raw);
  if (!digits) return 'Укажите номер телефона';
  if (!isValidPhoneDigits(digits)) return VALIDATION_MESSAGES.phone;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

export function getEmailError(raw: string, { required = true }: { required?: boolean } = {}): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return required ? 'Укажите email' : null;
  if (!isValidEmail(trimmed)) return VALIDATION_MESSAGES.email;
  return null;
}

export function getFullNameError(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'Укажите имя';
  if (trimmed.length < 2) return VALIDATION_MESSAGES.fullName;
  if (trimmed.length > 120) return 'Имя слишком длинное (максимум 120 символов)';
  return null;
}

const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;
const HAS_CYRILLIC = /[А-Яа-яЁё]/;

export function passwordMeetsPolicy(value: string): boolean {
  const s = String(value || '');
  if (s.length < 12) return false;
  if (HAS_CYRILLIC.test(s)) return false;
  if (!HAS_UPPER.test(s)) return false;
  if (!HAS_LOWER.test(s)) return false;
  if (!HAS_DIGIT.test(s)) return false;
  if (!HAS_SPECIAL.test(s)) return false;
  return true;
}

export function getPasswordError(raw: string): string | null {
  if (!String(raw || '').length) return 'Укажите пароль';
  if (!passwordMeetsPolicy(raw)) return VALIDATION_MESSAGES.password;
  return null;
}
