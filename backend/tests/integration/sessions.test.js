import request from 'supertest';
import {
  clearLastTestEmail,
  extractVerificationCodeFromEmail,
  getLastTestEmail,
} from '../../src/lib/mail/mail.service.js';
import prisma from '../../src/lib/prisma.js';
import { hashRefreshToken } from '../../src/lib/clientMeta.js';
import { app, registerClient, truncateAll } from '../helpers.js';

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';

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

function authFromLogin(res) {
  return {
    accessToken: res.body.accessToken,
    cookie: res.headers['set-cookie']?.join('; ') || '',
  };
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
      .set('User-Agent', CHROME_UA)
      .send({ identifier: email, password: 'Password123!ab' });

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', CHROME_UA);

    expect(security.status).toBe(200);
    expect(Array.isArray(security.body.sessions)).toBe(true);
    expect(security.body.sessions.length).toBeGreaterThan(0);
    expect(security.body.sessions.some((item) => /Chrome|macOS/i.test(item.device.label))).toBe(true);
    expect(Array.isArray(security.body.history)).toBe(true);
    expect(security.body.history[0].methodLabel).toBeTruthy();
    expect(security.body.history[0].device).toBeTruthy();
  });

  it('replaces a repeated login from the same browser and marks it current', async () => {
    const { email } = await registerClient({ email: 'same-device@test.local' });

    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', CHROME_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    const loginB = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', CHROME_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    expect(loginB.status).toBe(200);
    const auth = authFromLogin(loginB);

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .set('User-Agent', CHROME_UA);

    const chromeSessions = security.body.sessions.filter((item) => /Chrome/i.test(item.device.label));
    expect(chromeSessions).toHaveLength(1);
    expect(chromeSessions[0].current).toBe(true);
    expect(security.body.sessions[0].current).toBe(true);
  });

  it('keeps other browsers and hides leftover script sessions', async () => {
    const { email } = await registerClient({ email: 'multi-device@test.local' });

    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'curl/8.5.0')
      .send({ identifier: email, password: 'Password123!ab' });
    const chrome = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', CHROME_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    const firefox = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', FIREFOX_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    expect(firefox.status).toBe(200);
    const auth = authFromLogin(firefox);

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .set('User-Agent', FIREFOX_UA);

    expect(security.body.sessions.some((item) => item.device?.isBot)).toBe(false);
    expect(security.body.sessions.some((item) => /Chrome/i.test(item.device.label))).toBe(true);
    expect(security.body.sessions.some((item) => /Firefox/i.test(item.device.label))).toBe(true);
    expect(security.body.sessions.find((item) => item.current)?.device.label).toMatch(/Firefox/i);
    expect(security.body.history.some((item) => item.device?.isBot)).toBe(true);
    expect(chrome.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email } });
    const leftover = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashRefreshToken('leftover-script-session'),
        familyId: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 86400000),
        ip: '127.0.0.1',
        userAgent: 'curl/8.5.0',
        lastUsedAt: new Date(),
      },
    });
    const afterCleanup = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .set('User-Agent', FIREFOX_UA);
    expect(afterCleanup.body.sessions.some((item) => item.id === leftover.id)).toBe(false);
    expect(await prisma.refreshToken.findUnique({ where: { id: leftover.id } })).toBeNull();
  });

  it('revokes other sessions but keeps the current one', async () => {
    const { email } = await registerClient({ email: 'revoke-sessions@test.local' });

    const loginA = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', CHROME_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    expect(loginA.status).toBe(200);

    const loginB = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', FIREFOX_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    expect(loginB.status).toBe(200);

    const auth = authFromLogin(loginB);

    const securityBefore = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .set('Cookie', auth.cookie)
      .set('User-Agent', FIREFOX_UA);

    expect(securityBefore.body.sessions.length).toBeGreaterThan(1);
    expect(securityBefore.body.sessions.filter((item) => item.current)).toHaveLength(1);

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
      .set('Cookie', auth.cookie)
      .set('User-Agent', FIREFOX_UA);

    expect(securityAfter.body.sessions).toHaveLength(1);
    expect(securityAfter.body.sessions[0].current).toBe(true);
  });

  it('rejects session revoke without a valid email code', async () => {
    const { email } = await registerClient({ email: 'revoke-otp@test.local' });

    const loginA = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', CHROME_UA)
      .send({ identifier: email, password: 'Password123!ab' });
    const loginB = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', FIREFOX_UA)
      .send({ identifier: email, password: 'Password123!ab' });

    const auth = authFromLogin(loginB);

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
      .set('Cookie', auth.cookie)
      .set('User-Agent', FIREFOX_UA);
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
