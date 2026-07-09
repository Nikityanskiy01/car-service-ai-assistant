import { STORAGE_KEYS } from '../lib/storageKeys';
import { ApiError, localizeApiError } from './errors';
import type { AuthUser } from '../types/auth';

const API_BASE = '/api';
const CSRF_COOKIE = 'car_service_csrf';

let refreshPromise: Promise<boolean> | null = null;

function readCookie(name: string): string {
  const escaped = name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function mutatingMethod(method?: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase());
}

export function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: AuthUser | null): void {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.user);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearLocalAuthState(): void {
  localStorage.removeItem(STORAGE_KEYS.user);
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
      if (!response.ok) {
        clearLocalAuthState();
        return false;
      }
      const data = (await response.json()) as { user?: AuthUser };
      if (data.user) setCachedUser(data.user);
      return true;
    } catch {
      clearLocalAuthState();
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
    const csrf = readCookie(CSRF_COOKIE);
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
    throw new ApiError(localizeApiError(response.status, data, response.statusText), response.status, data);
  }
  return data as T;
}

export function getCsrfToken(): string {
  return readCookie(CSRF_COOKIE);
}
