import { describe, expect, it } from '@jest/globals';
import { isPathAllowedDuringTotpSetup, normalizeApiPath } from '../../src/lib/totpSetupPaths.js';

describe('totp setup allow-list', () => {
  it('нормализует хвост слэша, query и префикс /api', () => {
    expect(normalizeApiPath('/api/users/me/')).toBe('/api/users/me');
    expect(normalizeApiPath('/api/users/me?tab=security')).toBe('/api/users/me');
    expect(normalizeApiPath('/users/me')).toBe('/api/users/me');
  });

  it('пускает профиль и 2FA, но не канбан', () => {
    expect(isPathAllowedDuringTotpSetup('/api/users/me')).toBe(true);
    expect(isPathAllowedDuringTotpSetup('/api/users/me/security')).toBe(true);
    expect(isPathAllowedDuringTotpSetup('/api/users/me/2fa/setup')).toBe(true);
    expect(isPathAllowedDuringTotpSetup('/api/service-requests')).toBe(false);
    expect(isPathAllowedDuringTotpSetup('/api/users/me/notifications')).toBe(false);
  });
});
