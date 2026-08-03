import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { isStaleConsultationAccessError } from './consultationAccess';

describe('isStaleConsultationAccessError', () => {
  it('возвращает true для 403', () => {
    expect(isStaleConsultationAccessError(new ApiError('Forbidden', 403, { error: 'Forbidden' }))).toBe(true);
  });

  it('возвращает true для 401 с GUEST_TOKEN_REQUIRED', () => {
    expect(
      isStaleConsultationAccessError(
        new ApiError('Требуется вход', 401, { error: 'Требуется вход', code: 'GUEST_TOKEN_REQUIRED' }),
      ),
    ).toBe(true);
  });

  it('возвращает false для других ошибок', () => {
    expect(isStaleConsultationAccessError(new ApiError('Unauthorized', 401, { error: 'Unauthorized' }))).toBe(false);
    expect(isStaleConsultationAccessError(new Error('network'))).toBe(false);
  });
});
