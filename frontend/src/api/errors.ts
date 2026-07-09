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
  const raw = String(payload.error || fallbackStatusText || '').trim();

  const byCode: Record<string, string> = {
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

  if (status >= 500) return 'Временная ошибка сервера. Попробуйте еще раз чуть позже.';
  if (!raw) return 'Не удалось выполнить запрос. Попробуйте еще раз.';
  return raw;
}
