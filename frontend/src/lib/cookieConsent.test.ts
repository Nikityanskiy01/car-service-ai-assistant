import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACCEPT_ALL_COOKIE_DRAFT,
  COOKIE_CONSENT_KEY,
  DEFAULT_COOKIE_DRAFT,
  hasCookieConsentDecision,
  readCookieConsent,
  saveCookieConsent,
} from './cookieConsent';

describe('cookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('сохраняет и читает выбор пользователя', () => {
    saveCookieConsent(ACCEPT_ALL_COOKIE_DRAFT);
    expect(hasCookieConsentDecision()).toBe(true);
    expect(readCookieConsent()).toMatchObject({
      functional: true,
      analytics: true,
      marketing: true,
    });
  });

  it('отклонение оставляет только необходимые cookie', () => {
    saveCookieConsent(DEFAULT_COOKIE_DRAFT);
    expect(readCookieConsent()).toMatchObject({
      functional: false,
      analytics: false,
      marketing: false,
      necessary: true,
    });
  });

  it('мигрирует legacy-ключ accepted', () => {
    localStorage.setItem('car_service_cookie_notice', 'accepted');
    expect(hasCookieConsentDecision()).toBe(true);
    expect(readCookieConsent()?.functional).toBe(true);
  });

  it('игнорирует битый JSON', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, '{bad json');
    expect(readCookieConsent()).toBeNull();
    expect(hasCookieConsentDecision()).toBe(false);
  });
});
