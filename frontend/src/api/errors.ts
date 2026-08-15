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

export function localizeApiError(status: number, data: unknown, fallbackStatusText: string): string {
  const payload = (data || {}) as Record<string, unknown>;
  const code = String(payload.code || '').toUpperCase();
  const raw = String(payload.error || payload.detail || fallbackStatusText || '').trim();

  const byCode: Record<string, string> = {
    UNAUTHORIZED: 'Требуется авторизация.',
    FORBIDDEN: 'Недостаточно прав для выполнения действия.',
    CONSULTATION_FORBIDDEN: 'Нет доступа к сохранённой консультации. Начните новую сессию.',
    NOT_FOUND: 'Запрошенные данные не найдены.',
    BAD_REQUEST: 'Некорректный запрос. Проверьте введенные данные.',
    CLOSED: 'Консультация уже завершена. Начните новую сессию или оформите заявку.',
    ABANDONED: 'Сессия была прервана. Пожалуйста, начните новую консультацию.',
    CONFLICT: 'Действие уже выполнено ранее.',
    LLM_ERROR: 'Модуль ИИ временно недоступен. Попробуйте чуть позже.',
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
    PDF_FONT_MISSING:
      'Экспорт в PDF временно недоступен: на сервере не настроен шрифт с кириллицей. Обратитесь к администратору.',
  };

  if (code && byCode[code]) return byCode[code];

  if (status >= 500) return 'Временная ошибка сервера. Попробуйте еще раз чуть позже.';
  if (status === 403 && (!raw || raw.toLowerCase() === 'forbidden')) {
    return 'Недостаточно прав для выполнения действия.';
  }
  if (!raw) return 'Не удалось выполнить запрос. Попробуйте еще раз.';
  return raw;
}
