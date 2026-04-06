/** Ключи консультации в sessionStorage — общие для consult.js и api.js (без циклических импортов). */

const KEYS = ['consultSessionId', 'consultGuestToken', 'consultMode'];

export function clearConsultSessionStorage() {
  for (const k of KEYS) sessionStorage.removeItem(k);
}
