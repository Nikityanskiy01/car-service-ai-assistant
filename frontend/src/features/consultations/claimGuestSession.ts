import { api } from '../../api/client';
import { STORAGE_KEYS } from '../../lib/storageKeys';

/** Привязывает гостевую консультацию к аккаунту после входа/регистрации. */
export async function claimGuestConsultationSessionIfPresent(): Promise<boolean> {
  const sessionId = sessionStorage.getItem(STORAGE_KEYS.consultSessionId);
  const guestToken = sessionStorage.getItem(STORAGE_KEYS.consultGuestToken);
  if (!sessionId || !guestToken) return false;

  try {
    await api(`/consultations/${sessionId}/claim`, {
      method: 'POST',
      body: { guestToken },
    });
    sessionStorage.removeItem(STORAGE_KEYS.consultGuestToken);
    return true;
  } catch {
    return false;
  }
}
