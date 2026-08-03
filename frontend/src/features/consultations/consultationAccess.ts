import { ApiError } from '../../api/errors';
import { STORAGE_KEYS } from '../../lib/storageKeys';

/** Сессия в sessionStorage недоступна текущему пользователю — нужна новая. */
export function isStaleConsultationAccessError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 403) return true;
  if (error.status === 401) {
    const code = String((error.data as Record<string, unknown> | null)?.code || '').toUpperCase();
    return code === 'GUEST_TOKEN_REQUIRED';
  }
  return false;
}

export function clearStoredConsultationSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.consultSessionId);
  sessionStorage.removeItem(STORAGE_KEYS.consultGuestToken);
  sessionStorage.removeItem(STORAGE_KEYS.consultMode);
}
