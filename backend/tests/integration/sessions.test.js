import request from 'supertest';
import {
  clearLastTestEmail,
  extractVerificationCodeFromEmail,
  getLastTestEmail,
} from '../../src/lib/mail/mail.service.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function requestRevokeCode(auth, body = {}) {
  clearLastTestEmail();
  const start = await request(app)
    .post('/api/users/me/sessions/revoke/start')
    .set('Authorization', `Bearer ${auth.accessToken}`)
    .set('Cookie', auth.cookie)
    .send(body);
  expect(start.status).toBe(200);
  const code = extractVerificationCodeFromEmail(getLastTestEmail());
  expect(code).toMatch(/^\d{6}$/);
  return code;
}

describe('sessions and login history', () => {
  beforeEach(async () => {
    clearLastTestEmail();
    await truncateAll();
  });

  it('returns enriched sessions and login history after login', async () => {
    const { email, token } = await registerClient({ email: 'sessions@test.local' });

    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0')
      .send({ identifier: email, password: 'Password123!ab' });

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0');

    expect(security.status).toBe(200);
    expect(Array.isArray(security.body.sessions)).toBe(true);
    expect(security.body.sessions.length).toBeGreaterThan(0);
    expect(security.body.sessions[0].device.label).toMatch(/Chrome|macOS/i);
    expect(Array.isArray(security.body.history)).toBe(true);
    expect(security.body.history[0].methodLabel).toBeTruthy();
    expect(security.body.history[0].device).toBeTruthy();
  });

  it('revokes other sessions but keeps the current one', async () => {
    const { email } = await registerClient({ email: 'revoke-sessions@test.local' });

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ identifier: email, password: 'Password123!ab' });
    expect(loginA.status).toBe(200);

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ identifier: email, password: 'Password123!ab' });
    expect(loginB.status).toBe(200);

    const auth = {
      accessToken: loginB.body.accessToken,
      cookie: loginB.headers['set-cookie']?.join('; ') || '',
    };

    const securityBefore = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie);

    expect(securityBefore.body.sessions.length).toBeGreaterThan(1);

    const code = await requestRevokeCode(auth);
    const revoke = await request(app)
      .post('/api/users/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .send({ code });

    expect(revoke.status).toBe(200);
    expect(revoke.body.revoked).toBeGreaterThan(0);

    const securityAfter = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie);

    expect(securityAfter.body.sessions).toHaveLength(1);
    expect(securityAfter.body.sessions[0].current).toBe(true);
  });

  it('rejects session revoke without a valid email code', async () => {
    const { email } = await registerClient({ email: 'revoke-otp@test.local' });

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ identifier: email, password: 'Password123!ab' });
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ identifier: email, password: 'Password123!ab' });

    const auth = {
      accessToken: loginB.body.accessToken,
      cookie: loginB.headers['set-cookie']?.join('; ') || '',
    };

    const withoutCode = await request(app)
      .post('/api/users/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .send({});
    expect(withoutCode.status).toBe(400);

    const wrongCode = await request(app)
      .post('/api/users/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .send({ code: '000000' });
    expect(wrongCode.status).toBe(400);

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie);
    expect(security.body.sessions.length).toBeGreaterThan(1);

    const target = security.body.sessions.find((item) => !item.current);
    expect(target).toBeTruthy();
    expect(loginA.status).toBe(200);

    const code = await requestRevokeCode(auth, { scope: 'one', sessionId: target.id });
    const revoked = await request(app)
      .delete(`/api/users/me/sessions/${target.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .send({ code });

    expect(revoked.status).toBe(200);
    expect(revoked.body.currentRevoked).toBe(false);

    const reused = await request(app)
      .post('/api/users/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .send({ code });
    expect(reused.status).toBe(400);
  });
});
