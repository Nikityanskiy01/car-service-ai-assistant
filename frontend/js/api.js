import { clearConsultSessionStorage } from './consultStorage.js';

const API_BASE = `${window.location.origin}/api`;

export function getCsrfToken() {
  return readCookie('fm_csrf');
}

function readCookie(name) {
  const esc = name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
  const m = document.cookie.match(new RegExp(`(?:^|; )${esc}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

function localizeApiError(status, data, fallbackStatusText) {
  const code = String(data?.code || '').toUpperCase();
  const raw = String(data?.error || fallbackStatusText || '').trim();

  const byCode = {
    UNAUTHORIZED: 'Требуется авторизация.',
    FORBIDDEN: 'Недостаточно прав для выполнения действия.',
    NOT_FOUND: 'Запрошенные данные не найдены.',
    BAD_REQUEST: 'Некорректный запрос. Проверьте введенные данные.',
    CLOSED: 'Консультация уже завершена. Начните новую сессию или оформите заявку.',
    ABANDONED: 'Сессия была прервана. Пожалуйста, начните новую консультацию.',
    CONFLICT: 'Действие уже выполнено ранее.',
    LLM_ERROR: 'Модуль ИИ временно недоступен. Попробуйте чуть позже.',
    GUEST_TOKEN_REQUIRED: 'Сессия гостя истекла. Начните новую консультацию.',
    CSRF: 'Сессия устарела. Обновите страницу и попробуйте снова.',
    PDF_FONT_MISSING:
      'Экспорт в PDF временно недоступен: на сервере не настроен шрифт с кириллицей. Обратитесь к администратору.',
  };
  if (code && byCode[code]) return byCode[code];

  const englishMap = new Map([
    ['Consultation is closed', 'Консультация уже завершена. Начните новую сессию или оформите заявку.'],
    ['Session abandoned', 'Сессия была прервана. Пожалуйста, начните новую консультацию.'],
    ['Session not found', 'Сессия не найдена. Начните новую консультацию.'],
    ['Invalid guest token', 'Гостевая сессия недействительна. Начните новую консультацию.'],
    ['guestToken required', 'Для гостевой сессии требуется токен. Начните новую консультацию.'],
    ['Forbidden', 'Недостаточно прав для выполнения действия.'],
    ['Unauthorized', 'Требуется авторизация.'],
    ['Unknown service category', 'Неизвестная категория услуги.'],
    ['LLM unavailable', 'Модуль ИИ временно недоступен. Попробуйте чуть позже.'],
  ]);
  if (englishMap.has(raw)) return englishMap.get(raw);

  if (status >= 500) {
    if (raw && raw !== 'Internal server error') return raw;
    return 'Временная ошибка сервера. Попробуйте еще раз чуть позже.';
  }
  if (!raw) return 'Не удалось выполнить запрос. Попробуйте еще раз.';
  return raw;
}

/** @deprecated Токены только в httpOnly-cookie; для проверки «вошёл ли» используйте getUser() */
export function getToken() {
  return null;
}

export function setToken() {
  localStorage.removeItem('token');
}

export function getRefreshToken() {
  return null;
}

export function setRefreshToken() {
  localStorage.removeItem('refreshToken');
}

export function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(u) {
  if (!u) {
    localStorage.removeItem('user');
    clearConsultSessionStorage();
    return;
  }
  let prev = null;
  try {
    const raw = localStorage.getItem('user');
    prev = raw ? JSON.parse(raw) : null;
  } catch {
    prev = null;
  }
  localStorage.setItem('user', JSON.stringify(u));
  if (prev?.id != null && u.id != null && String(prev.id) !== String(u.id)) {
    clearConsultSessionStorage();
  }
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  clearConsultSessionStorage();
}

let refreshPromise = null;

async function tryRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        clearAuth();
        return false;
      }
      const data = await res.json();
      if (data.user) setUser(data.user);
      return true;
    } catch {
      clearAuth();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function mutatingMethod(m) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(m || 'GET').toUpperCase());
}

async function rawFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body != null && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (mutatingMethod(opts.method) && !opts.skipCsrf) {
    const csrf = readCookie('fm_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  if (opts.guestToken) {
    headers['X-Consultation-Guest-Token'] = opts.guestToken;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers,
    body:
      opts.body != null && typeof opts.body === 'object' && !(opts.body instanceof FormData)
        ? JSON.stringify(opts.body)
        : opts.body,
  });
  return res;
}

async function authFetch(path, opts = {}) {
  let res = await rawFetch(path, opts);
  if (res.status === 401 && !opts.skipAuth && !opts._retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, { ...opts, _retried: true });
    }
  }
  return res;
}

/**
 * GET (или другой метод) бинарного ответа с той же авторизацией и гостевым заголовком, что и api().
 * @returns {{ blob: Blob, filename: string }}
 */
export async function downloadApiBlob(path, opts = {}) {
  const res = await authFetch(path, { ...opts, method: opts.method || 'GET' });
  if (!res.ok) {
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || res.statusText };
    }
    const err = new Error(localizeApiError(res.status, data, res.statusText));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const star = /filename\*\s*=\s*UTF-8''([^;\s]+)/i.exec(cd);
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(cd);
  const plain = /filename\s*=\s*([^;\s]+)/i.exec(cd);
  let filename = 'download.bin';
  if (star) {
    try {
      filename = decodeURIComponent(star[1]);
    } catch {
      filename = star[1];
    }
  } else if (quoted) {
    filename = quoted[1];
  } else if (plain) {
    filename = plain[1].replace(/^["']|["']$/g, '');
  }
  return { blob, filename };
}

export async function downloadApiFile(path, opts = {}) {
  const { blob, filename } = await downloadApiBlob(path, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function api(path, opts = {}) {
  const res = await authFetch(path, opts);

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || res.statusText };
  }
  if (!res.ok) {
    const err = new Error(localizeApiError(res.status, data, res.statusText));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
