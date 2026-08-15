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
});
