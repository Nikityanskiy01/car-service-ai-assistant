import request from 'supertest';
import { clearLastTestEmail, extractVerificationCodeFromEmail, getLastTestEmail } from '../../src/lib/mail/mail.service.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('auth', () => {
  beforeEach(async () => {
    clearLastTestEmail();
    await truncateAll();
  });

  it('register → login → /users/me', async () => {
    const { email, token } = await registerClient();
    expect(token).toBeTruthy();

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!ab' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
  });

  it('register rejects password without digits', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'pwweak1@test.local',
        password: 'onlyletters',
        fullName: 'Test',
        phone: '8-999-111-22-33',
        consentPersonalData: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/цифр/i);
  });

  it('register rejects password without letters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'pwweak2@test.local',
        password: '12345678',
        fullName: 'Test',
        phone: '8-999-111-22-44',
        consentPersonalData: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/букв/i);
  });

  it('register rejects password with Cyrillic', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'pwcyr@test.local',
        password: 'Пароль123',
        fullName: 'Test',
        phone: '8-999-111-22-55',
        consentPersonalData: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/кирилл/i);
  });

  it('register rejects invalid phone', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'badphone@test.local',
        password: 'Password123!ab',
        fullName: 'Test',
        phone: '12',
        consentPersonalData: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/телефон/i);
  });

  it('register rejects without consent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'noconsent@test.local',
        password: 'Password123!ab',
        fullName: 'Test',
        phone: '8-999-111-22-66',
        consentPersonalData: false,
      });
    expect(res.status).toBe(400);
  });

  it('forgot-password → reset-password → login with new password', async () => {
    const { email } = await registerClient({ email: 'reset@test.local' });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.message).toMatch(/отправили/i);

    const mail = getLastTestEmail();
    expect(mail?.to).toBe(email);
    const match = mail?.html?.match(/#token=([^"&]+)/) ?? mail?.html?.match(/token=([^"&]+)/);
    expect(match?.[1]).toBeTruthy();
    const token = decodeURIComponent(match[1]);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'NewPassword1!xy' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!ab' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewPassword1!xy' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.accessToken).toBeTruthy();
  });

  it('forgot-password returns same message for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.local' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/отправили/i);
    expect(getLastTestEmail()).toBeNull();
  });

  it('invalidates access token after password reset', async () => {
    const { email, token } = await registerClient({ email: 'revoke@test.local' });

    await request(app).post('/api/auth/forgot-password').send({ email });
    const mail = getLastTestEmail();
    const match = mail?.html?.match(/#token=([^"&]+)/) ?? mail?.html?.match(/token=([^"&]+)/);
    const resetToken = decodeURIComponent(match[1]);

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'NewPassword1!xy' });

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  it('register duplicate email returns generic failure', async () => {
    await registerClient({ email: 'dup@test.local' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'dup@test.local',
        password: 'Password123!ab',
        fullName: 'Test',
        phone: '+79990001122',
        consentPersonalData: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_FAILED');
  });

  it('register requires email verification before login', async () => {
    const email = 'unverified@test.local';
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123!ab',
        fullName: 'Test',
        phone: '+79990001122',
        consentPersonalData: true,
      });
    expect(reg.status).toBe(201);
    expect(reg.body.requiresEmailVerification).toBe(true);

    const loginBefore = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!ab' });
    expect(loginBefore.status).toBe(403);
    expect(loginBefore.body.code).toBe('EMAIL_NOT_VERIFIED');

    const code = extractVerificationCodeFromEmail(getLastTestEmail());
    const verify = await request(app).post('/api/auth/verify-email').send({ email, code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();

    const loginAfter = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!ab' });
    expect(loginAfter.status).toBe(200);
  });
});
