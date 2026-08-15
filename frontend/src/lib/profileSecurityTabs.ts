export type SecuritySection = 'password' | 'access' | 'protection' | 'sessions' | 'history' | 'privacy';

export const SECURITY_SECTION_ITEMS: Array<{ id: SecuritySection; label: string }> = [
  { id: 'password', label: 'Пароль' },
  { id: 'access', label: 'Вход' },
  { id: 'protection', label: 'Защита' },
  { id: 'sessions', label: 'Сессии' },
  { id: 'history', label: 'История' },
  { id: 'privacy', label: 'Данные' },
];

export function parseSecuritySection(value: string | null): SecuritySection {
  if (
    value === 'access' ||
    value === 'protection' ||
    value === 'sessions' ||
    value === 'history' ||
    value === 'privacy'
  ) {
    return value;
  }
  return 'password';
}
