import { describe, expect, it } from '@jest/globals';
import { authAttemptKey, isOperationalApiPath } from '../../src/middleware/rateLimitConfig.js';

describe('rateLimitConfig', () => {
  it('ключ входа включает IP и логин', () => {
    expect(authAttemptKey({ ip: '172.18.0.1', body: { identifier: '  Client@Mail.RU ' } })).toBe(
      '172.18.0.1:client@mail.ru',
    );
  });

  it('без логина остаётся только IP', () => {
    expect(authAttemptKey({ ip: '10.0.0.8', body: {} })).toBe('10.0.0.8');
  });

  it('не считает health/live в общий лимит', () => {
    expect(isOperationalApiPath({ originalUrl: '/api/live' })).toBe(true);
    expect(isOperationalApiPath({ originalUrl: '/api/auth/login' })).toBe(false);
  });
});
