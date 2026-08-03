export const COOKIE_CONSENT_KEY = 'car_service_cookie_consent';
export const LEGACY_COOKIE_NOTICE_KEY = 'car_service_cookie_notice';

export type CookieCategory = 'functional' | 'analytics' | 'marketing';

export type CookieConsentPreferences = {
  version: 1;
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export type CookieConsentDraft = Pick<CookieConsentPreferences, 'functional' | 'analytics' | 'marketing'>;

export const DEFAULT_COOKIE_DRAFT: CookieConsentDraft = {
  functional: false,
  analytics: false,
  marketing: false,
};

export const ACCEPT_ALL_COOKIE_DRAFT: CookieConsentDraft = {
  functional: true,
  analytics: true,
  marketing: true,
};

function parseConsent(raw: string | null): CookieConsentPreferences | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (data.version !== 1 || data.necessary !== true) return null;
    return {
      version: 1,
      necessary: true,
      functional: Boolean(data.functional),
      analytics: Boolean(data.analytics),
      marketing: Boolean(data.marketing),
      decidedAt: typeof data.decidedAt === 'string' ? data.decidedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function readCookieConsent(): CookieConsentPreferences | null {
  try {
    const current = parseConsent(localStorage.getItem(COOKIE_CONSENT_KEY));
    if (current) return current;
    if (localStorage.getItem(LEGACY_COOKIE_NOTICE_KEY) === 'accepted') {
      return {
        version: 1,
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true,
        decidedAt: new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function hasCookieConsentDecision(): boolean {
  return readCookieConsent() !== null;
}

export function saveCookieConsent(draft: CookieConsentDraft): CookieConsentPreferences {
  const next: CookieConsentPreferences = {
    version: 1,
    necessary: true,
    functional: draft.functional,
    analytics: draft.analytics,
    marketing: draft.marketing,
    decidedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_COOKIE_NOTICE_KEY);
  } catch {
    /* ignore */
  }
  return next;
}
