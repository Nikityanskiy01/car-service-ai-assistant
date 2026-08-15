import { describe, expect, it } from '@jest/globals';
import { createGuestToken, guestTokenMatches, hashGuestToken } from '../../src/lib/guestToken.js';

describe('guest tokens', () => {
  it('accepts HMAC and rejects legacy plaintext of the same length', () => {
    const raw = createGuestToken();
    const stored = hashGuestToken(raw);
    expect(guestTokenMatches(stored, raw)).toBe(true);
    expect(guestTokenMatches(raw, raw)).toBe(false);
    expect(guestTokenMatches(stored, stored)).toBe(false);
  });
});
