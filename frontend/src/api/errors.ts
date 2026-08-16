export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function hasCyrillic(value: string): boolean {
  return /[А-Яа-яЁё]/.test(value);
}

function looksEnglish(value: string): boolean {
  return /[A-Za-z]/.test(value) && !hasCyrillic(value);
}

export function localizeApiError(
  status: number,
  data: unknown,
  fallbackStatusText: string,
  retryAfter?: string | null,
): string {
  const payload = (data || {}) as Record<string, unknown>;
  const code = String(payload.code || '').toUpperCase();
  const raw = String(payload.error || payload.detail || fallbackStatusText || '').trim();
  const rawLower = raw.toLowerCase();

  const byCode: Record<string, string> = {
    UNAUTHORIZED: 'Требуется авторизация.',
    FORBIDDEN: 'Недостаточно прав для выполнения действия.',
    CONSULTATION_FORBIDDEN: 'Нет доступа к сохранённой консультации. Начните новую сессию.',
    NOT_FOUND: 'Запрошенные данные не найдены.',
    BAD_REQUEST: 'Некорректный запрос. Проверьте введенные данные.',
    VALIDATION_ERROR: 'Проверьте введённые данные.',
    CLOSED: 'Консультация уже завершена. Начните новую сессию или оформите заявку.',
    ABANDONED: 'Сессия была прервана. Пожалуйста, начните новую консультацию.',
    CONFLICT: 'Действие уже выполнено ранее.',
    LLM_ERROR: 'Модуль ИИ временно недоступен. Попробуйте чуть позже.',
    LLM_RATE_LIMITED: 'Слишком много запросов к интеллектуальному анализу. Подождите и попробуйте снова.',
    GUEST_TOKEN_REQUIRED: 'Сессия гостя истекла. Начните новую консультацию.',
    CSRF: 'Сессия устарела. Обновите страницу и попробуйте снова.',
    RATE_LIMITED: 'Слишком много попыток. Подождите и попробуйте снова.',
    EMAIL_NOT_VERIFIED: 'Подтвердите email — мы отправили код при регистрации.',
    SMS_NOT_CONFIGURED:
      'SMS-провайдер ещё не подключён. Войдите паролем, кодом на почту или через Telegram.',
    TELEGRAM_NOT_CONFIGURED: 'Подключение Telegram пока недоступно.',
    OTP_COOLDOWN: 'Подождите немного, прежде чем запрашивать новый код.',
    PHONE_NOT_VERIFIED: 'Сначала подтвердите телефон кодом с почты.',
    TELEGRAM_NOT_LINKED: 'Сначала подключите Telegram-бота в настройках безопасности.',
    PHONE_TAKEN: 'Этот номер уже подтверждён в другом аккаунте.',
    THREAD_LOCKED: 'Переписка по этой заявке закрыта.',
    INCOMPLETE: 'Сначала завершите консультацию, чтобы продолжить.',
    TOTP_SETUP_REQUIRED: 'Включите двухфакторную защиту, чтобы продолжить.',
    PDF_FONT_MISSING:
      'Экспорт в PDF временно недоступен: на сервере не настроен шрифт с кириллицей. Обратитесь к администратору.',
  };

  const byRaw: Record<string, string> = {
    'too many attempts, please try again later': byCode.RATE_LIMITED,
    'too many registration attempts, please try again later':
      'Слишком много попыток регистрации. Подождите и попробуйте снова.',
    'too many requests, please try again later': 'Слишком много запросов. Подождите и попробуйте снова.',
    forbidden: byCode.FORBIDDEN,
    unauthorized: byCode.UNAUTHORIZED,
    'not found': byCode.NOT_FOUND,
    'session not found': 'Сессия не найдена.',
    'validation failed': byCode.VALIDATION_ERROR,
    'internal server error': 'Временная ошибка сервера. Попробуйте еще раз чуть позже.',
    'csrf token missing or invalid': byCode.CSRF,
    'refresh token required': 'Требуется повторный вход. Обновите страницу.',
    'refresh token expired or invalid': 'Сессия истекла. Войдите снова.',
  };

  const retrySec = Number(retryAfter);
  if (status === 429 && Number.isFinite(retrySec) && retrySec > 0) {
    if (retrySec < 90) {
      const seconds = Math.max(1, Math.round(retrySec));
      return `Слишком много попыток. Подождите ${seconds} сек. и попробуйте снова.`;
    }
    const minutes = Math.max(1, Math.ceil(retrySec / 60));
    return `Слишком много попыток. Подождите ${minutes} мин. и попробуйте снова.`;
  }

  if (raw && hasCyrillic(raw)) return raw;
  if (code && byCode[code]) return byCode[code];
  if (rawLower && byRaw[rawLower]) return byRaw[rawLower];
  if (rawLower.includes('too many')) return byCode.RATE_LIMITED;

  if (status >= 500) return 'Временная ошибка сервера. Попробуйте еще раз чуть позже.';
  if (status === 429) return byCode.RATE_LIMITED;
  if (status === 403) return byCode.FORBIDDEN;
  if (status === 401) return byCode.UNAUTHORIZED;
  if (status === 404) return byCode.NOT_FOUND;
  if (!raw) return 'Не удалось выполнить запрос. Попробуйте еще раз.';
  if (looksEnglish(raw)) {
    if (status === 400 || status === 422) return byCode.VALIDATION_ERROR;
    return 'Не удалось выполнить запрос. Попробуйте еще раз.';
  }
  return raw;
}
