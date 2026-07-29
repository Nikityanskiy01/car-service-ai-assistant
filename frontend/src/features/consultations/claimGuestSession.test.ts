import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimGuestConsultationSessionIfPresent } from './claimGuestSession';
import { STORAGE_KEYS } from '../../lib/storageKeys';

const apiMock = vi.fn();

vi.mock('../../api/client', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

describe('claimGuestConsultationSessionIfPresent', () => {
  beforeEach(() => {
    apiMock.mockReset();
    sessionStorage.clear();
  });

  it('returns false when session data is missing', async () => {
    expect(await claimGuestConsultationSessionIfPresent()).toBe(false);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('claims session and clears guest token', async () => {
    sessionStorage.setItem(STORAGE_KEYS.consultSessionId, 'session-1');
    sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, 'guest-token-1234567890');
    apiMock.mockResolvedValue({ id: 'session-1' });

    expect(await claimGuestConsultationSessionIfPresent()).toBe(true);
    expect(apiMock).toHaveBeenCalledWith('/consultations/session-1/claim', {
      method: 'POST',
      body: { guestToken: 'guest-token-1234567890' },
    });
    expect(sessionStorage.getItem(STORAGE_KEYS.consultGuestToken)).toBeNull();
  });

  it('returns false when claim fails', async () => {
    sessionStorage.setItem(STORAGE_KEYS.consultSessionId, 'session-1');
    sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, 'guest-token-1234567890');
    apiMock.mockRejectedValue(new Error('conflict'));

    expect(await claimGuestConsultationSessionIfPresent()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEYS.consultGuestToken)).toBe('guest-token-1234567890');
  });
});
