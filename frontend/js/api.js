const API_BASE = `${window.location.origin}/api`;

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

  if (status >= 500) return 'Временная ошибка сервера. Попробуйте еще раз чуть позже.';
  if (!raw) return 'Не удалось выполнить запрос. Попробуйте еще раз.';
  return raw;
}

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(t) {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
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
  if (u) localStorage.setItem('user', JSON.stringify(u));
  else localStorage.removeItem('user');
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body != null && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const t = getToken();
  if (t && !opts.skipAuth) headers.Authorization = `Bearer ${t}`;
  if (opts.guestToken) {
    headers['X-Consultation-Guest-Token'] = opts.guestToken;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    body:
      opts.body != null && typeof opts.body === 'object' && !(opts.body instanceof FormData)
        ? JSON.stringify(opts.body)
        : opts.body,
  });
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
