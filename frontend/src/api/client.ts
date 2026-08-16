import { STORAGE_KEYS } from '../lib/storageKeys';
import { ApiError, localizeApiError } from './errors';
import type { AuthUser } from '../types/auth';

const API_BASE = '/api';
const CSRF_COOKIE = 'car_service_csrf';
const CSRF_COOKIE_HOST = '__Host-car_service_csrf';

let refreshPromise: Promise<boolean> | null = null;

function readCookie(name: string): string {
  const escaped = name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function mutatingMethod(method?: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase());
}

const ROLES = new Set(['CLIENT', 'MANAGER', 'ADMINISTRATOR']);

function clearLegacyUserCache() {
  try {
    localStorage.removeItem(STORAGE_KEYS.user);
  } catch {
    // ignore quota / private mode
  }
}

export function getCachedUser(): AuthUser | null {
  clearLegacyUserCache();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; role?: string };
    if (!parsed?.id || !ROLES.has(String(parsed.role || ''))) return null;
    return {
      id: parsed.id,
      role: parsed.role as AuthUser['role'],
      email: '',
      fullName: '',
      phone: '',
    };
  } catch {
    return null;
  }
}

export function setCachedUser(user: AuthUser | null): void {
  clearLegacyUserCache();
  if (!user) {
    sessionStorage.removeItem(STORAGE_KEYS.user);
    return;
  }
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ id: user.id, role: user.role }));
}

export function clearLocalAuthState(): void {
  clearLegacyUserCache();
  sessionStorage.removeItem(STORAGE_KEYS.user);
  sessionStorage.removeItem(STORAGE_KEYS.consultGuestToken);
  sessionStorage.removeItem(STORAGE_KEYS.consultMode);
  sessionStorage.removeItem(STORAGE_KEYS.consultSessionId);
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.status === 401 || response.status === 403) {
        clearLocalAuthState();
        return false;
      }
      if (!response.ok) return false;
      const data = (await response.json()) as { user?: AuthUser };
      if (data.user) setCachedUser(data.user);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  guestToken?: string | null;
  skipAuthRefresh?: boolean;
  skipCsrf?: boolean;
};

async function rawFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (mutatingMethod(options.method) && !options.skipCsrf) {
    const csrf = readCookie(CSRF_COOKIE_HOST) || readCookie(CSRF_COOKIE);
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  if (options.guestToken) headers.set('X-Consultation-Guest-Token', options.guestToken);

  const body =
    options.body != null && typeof options.body === 'object' && !(options.body instanceof FormData)
      ? JSON.stringify(options.body)
      : options.body;

  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body: (body ?? null) as BodyInit | null,
  });
}

async function authFetch(path: string, options: ApiOptions = {}): Promise<Response> {
  let response = await rawFetch(path, options);
  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await rawFetch(path, { ...options, skipAuthRefresh: true });
  }
  return response;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await authFetch(path, options);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || response.statusText };
  }
  if (!response.ok) {
    throw new ApiError(
      localizeApiError(response.status, data, response.statusText, response.headers.get('Retry-After')),
      response.status,
      data,
    );
  }
  return data as T;
}

export function getCsrfToken(): string {
  return readCookie(CSRF_COOKIE_HOST) || readCookie(CSRF_COOKIE);
}

function parseContentDispositionFilename(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* ignore */
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  if (plain?.[1]) return plain[1].trim();
  return fallback;
}

/**
 * Скачивание файла из API с cookie-авторизацией (PDF, сканы документов).
 */
export async function downloadApiFile(path: string, fallbackFilename: string): Promise<void> {
  const apiPath = path.startsWith('/api') ? path.slice(4) : path.startsWith(API_BASE) ? path.slice(API_BASE.length) : path;
  const response = await authFetch(apiPath);
  if (!response.ok) {
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || response.statusText };
    }
    throw new ApiError(localizeApiError(response.status, data, response.statusText), response.status, data);
  }
  const blob = await response.blob();
  const filename = parseContentDispositionFilename(
    response.headers.get('Content-Disposition'),
    fallbackFilename,
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Открыть файл из API в новой вкладке (preview PDF/изображения).
 */
export async function openApiFileInNewTab(path: string): Promise<void> {
  const apiPath = path.startsWith('/api') ? path.slice(4) : path.startsWith(API_BASE) ? path.slice(API_BASE.length) : path;
  const response = await authFetch(apiPath);
  if (!response.ok) {
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || response.statusText };
    }
    throw new ApiError(localizeApiError(response.status, data, response.statusText), response.status, data);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const tab = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!tab) {
    URL.revokeObjectURL(objectUrl);
    throw new ApiError('Не удалось открыть вкладку. Разрешите pop-up или скачайте файл.', 0, null);
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
