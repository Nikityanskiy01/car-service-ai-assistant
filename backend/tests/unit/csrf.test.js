import { afterEach, describe, expect, it } from '@jest/globals';
import { csrfProtection } from '../../src/middleware/csrf.js';

function callCsrf(req) {
  return new Promise((resolve) => {
    const res = {
      status(code) {
        return {
          json(body) {
            resolve({ next: false, status: code, body });
          },
        };
      },
    };
    csrfProtection(req, res, () => resolve({ next: true }));
  });
}

describe('csrfProtection', () => {
  const prev = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prev;
  });

  it('пропускает login/2fa при leftover auth-cookie без CSRF-заголовка', async () => {
    process.env.NODE_ENV = 'development';
    const out = await callCsrf({
      method: 'POST',
      baseUrl: '/api',
      path: '/auth/login/2fa',
      cookies: { car_service_at: 'stale-access', car_service_rt: 'stale-refresh' },
      headers: {},
    });
    expect(out).toEqual({ next: true });
  });

  it('пропускает otp/start и otp/verify так же, как login', async () => {
    process.env.NODE_ENV = 'development';
    const start = await callCsrf({
      method: 'POST',
      baseUrl: '/api',
      path: '/auth/otp/start',
      cookies: { car_service_at: 'stale' },
      headers: {},
    });
    const verify = await callCsrf({
      method: 'POST',
      baseUrl: '/api',
      path: '/auth/otp/verify',
      cookies: { car_service_rt: 'stale' },
      headers: {},
    });
    expect(start.next).toBe(true);
    expect(verify.next).toBe(true);
  });

  it('по-прежнему требует CSRF на обычных POST при auth-cookie', async () => {
    process.env.NODE_ENV = 'development';
    const out = await callCsrf({
      method: 'POST',
      baseUrl: '/api',
      path: '/users/me/password',
      cookies: { car_service_at: 'stale' },
      headers: {},
    });
    expect(out.next).toBe(false);
    expect(out.status).toBe(403);
    expect(out.body.code).toBe('CSRF');
  });
});
