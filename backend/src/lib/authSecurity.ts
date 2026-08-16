/** Precomputed bcrypt hash — constant-time path when user/email is unknown. */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW';

export const REGISTRATION_FAILED_MESSAGE =
  'Не удалось зарегистрироваться. Проверьте данные или войдите в существующий аккаунт.';

export const INVALID_CREDENTIALS_MESSAGE = 'Неверный телефон, почта или пароль.';

/** @param email */
export function normalizeAuthEmail(email) {
  return String(email || '').trim().toLowerCase();
}
