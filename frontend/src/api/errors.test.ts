import { describe, expect, it } from 'vitest';
import { localizeApiError } from './errors';

describe('localizeApiError', () => {
  it('не маскирует обычный 403 под ошибку консультации', () => {
    expect(localizeApiError(403, { error: 'Forbidden' }, 'Forbidden')).toBe(
      'Недостаточно прав для выполнения действия.',
    );
    expect(localizeApiError(403, { error: 'Forbidden', code: 'FORBIDDEN' }, 'Forbidden')).toBe(
      'Недостаточно прав для выполнения действия.',
    );
  });

  it('оставляет отдельный текст только для доступа к консультации', () => {
    expect(
      localizeApiError(403, { error: 'Forbidden', code: 'CONSULTATION_FORBIDDEN' }, 'Forbidden'),
    ).toBe('Нет доступа к сохранённой консультации. Начните новую сессию.');
  });

  it('переводит лимит попыток входа', () => {
    expect(localizeApiError(429, { error: 'Too many attempts, please try again later' }, 'Too Many Requests')).toBe(
      'Слишком много попыток. Подождите и попробуйте снова.',
    );
  });

  it('добавляет время ожидания из Retry-After', () => {
    expect(
      localizeApiError(429, { error: 'Too many attempts, please try again later' }, 'Too Many Requests', '372'),
    ).toBe('Слишком много попыток. Подождите 7 мин. и попробуйте снова.');
  });

  it('не затирает уже русское сообщение с общим кодом', () => {
    expect(localizeApiError(400, { error: 'Укажите корректный номер телефона', code: 'BAD_REQUEST' }, '')).toBe(
      'Укажите корректный номер телефона',
    );
  });
});
