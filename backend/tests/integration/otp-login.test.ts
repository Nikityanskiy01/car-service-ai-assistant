import request from 'supertest';
import { clearLastTestEmail, extractVerificationCodeFromEmail, getLastTestEmail } from '../../src/lib/mail/mail.service.js';
import { clearLastTestSms, extractOtpFromSms, getLastTestSms } from '../../src/lib/sms/sms.service.js';
import { clearLastTestTelegram, extractOtpFromTelegram, getLastTestTelegram } from '../../src/modules/notifications/telegramAuth.bot.js';
import { completeTelegramLinkFromBot } from '../../src/modules/users/contactVerify.service.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('otp login channels', () => {
  beforeEach(async () => {
    clearLastTestEmail();
    clearLastTestSms();
    clearLastTestTelegram();
    await truncateAll();
  });

  it('returns public login options', async () => {
    const res = await request(app).get('/api/auth/login-options');
    expect(res.status).toBe(200);
    expect(res.body.password).toBe(true);
    expect(res.body.emailOtp).toBe(true);
    expect(res.body.sms.configured).toBe(false);
  });

  it('logs in with email OTP', async () => {
    const { email, token } = await registerClient({ email: 'otp-mail@t.test' });
    expect(token).toBeTruthy();
    clearLastTestEmail();

    const start = await request(app).post('/api/auth/otp/start').send({ channel: 'email', email });
    expect(start.status).toBe(200);
    expect(start.body.challengeToken).toBeTruthy();
    const code = extractVerificationCodeFromEmail(getLastTestEmail());
    expect(code).toMatch(/^\d{6}$/);

    const verify = await request(app)
      .post('/api/auth/otp/verify')
      .send({ challengeToken: start.body.challengeToken, code });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.user.email).toBe(email);
  });

  it('requires the current password to disable email OTP login', async () => {
    const { token } = await registerClient({ email: 'otp-disable@t.test' });

    const withoutPassword = await request(app)
      .post('/api/users/me/login-methods')
      .set('Authorization', `Bearer ${token}`)
      .send({ loginEmailOtpEnabled: false });
    expect(withoutPassword.status).toBe(400);

    const wrongPassword = await request(app)
      .post('/api/users/me/login-methods')
      .set('Authorization', `Bearer ${token}`)
      .send({ loginEmailOtpEnabled: false, password: 'wrong-password' });
    expect(wrongPassword.status).toBe(400);

    const confirmed = await request(app)
      .post('/api/users/me/login-methods')
      .set('Authorization', `Bearer ${token}`)
      .send({ loginEmailOtpEnabled: false, password: 'Password123!ab' });
    expect(confirmed.status).toBe(200);

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${token}`);
    expect(security.body.loginMethods.emailOtp).toBe(false);
  });

  it('verifies phone via email code and then logs in with SMS in test', async () => {
    const { email, token } = await registerClient({
      email: 'otp-phone@t.test',
      phone: '+79990001122',
    });

    const startVerify = await request(app)
      .post('/api/users/me/phone/verify/start')
      .set('Authorization', `Bearer ${token}`);
    expect(startVerify.status).toBe(200);
    const phoneCode = extractVerificationCodeFromEmail(getLastTestEmail());
    expect(phoneCode).toMatch(/^\d{6}$/);

    const confirm = await request(app)
      .post('/api/users/me/phone/verify/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: phoneCode });
    expect(confirm.status).toBe(200);
    expect(confirm.body.phoneVerified).toBe(true);

    const startSms = await request(app)
      .post('/api/auth/otp/start')
      .send({ channel: 'sms', phone: '89990001122' });
    expect(startSms.status).toBe(200);
    const smsCode = extractOtpFromSms(getLastTestSms());
    expect(smsCode).toMatch(/^\d{6}$/);

    const login = await request(app)
      .post('/api/auth/otp/verify')
      .send({ challengeToken: startSms.body.challengeToken, code: smsCode });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(email);
  });

  it('links telegram after phone verification and logs in via bot code', async () => {
    const { email, token } = await registerClient({
      email: 'otp-tg@t.test',
      phone: '+79990003344',
    });

    await request(app)
      .post('/api/users/me/phone/verify/start')
      .set('Authorization', `Bearer ${token}`);
    const phoneCode = extractVerificationCodeFromEmail(getLastTestEmail());
    await request(app)
      .post('/api/users/me/phone/verify/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: phoneCode });

    const link = await request(app)
      .post('/api/users/me/telegram/link/start')
      .set('Authorization', `Bearer ${token}`);
    expect(link.status).toBe(200);
    expect(link.body.code).toMatch(/^[A-Z0-9]{8}$/);

    const linked = await completeTelegramLinkFromBot({
      code: link.body.code,
      chatId: '424242',
      username: 'demo_client',
    });
    expect(linked.ok).toBe(true);

    const security = await request(app)
      .get('/api/users/me/security')
      .set('Authorization', `Bearer ${token}`);
    expect(security.body.telegramLinked).toBe(true);
    expect(security.body.phoneVerified).toBe(true);
    expect(security.body.loginMethods.telegram).toBe(true);

    const startTg = await request(app)
      .post('/api/auth/otp/start')
      .send({ channel: 'telegram', phone: '79990003344' });
    expect(startTg.status).toBe(200);
    const tgCode = extractOtpFromTelegram(getLastTestTelegram());
    expect(tgCode).toMatch(/^\d{6}$/);

    const login = await request(app)
      .post('/api/auth/otp/verify')
      .send({ challengeToken: startTg.body.challengeToken, code: tgCode });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(email);
    expect(login.body.user.telegramLinked).toBe(true);

    const unlinkWithoutPassword = await request(app)
      .post('/api/users/me/telegram/unlink')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(unlinkWithoutPassword.status).toBe(400);

    const unlinkConfirmed = await request(app)
      .post('/api/users/me/telegram/unlink')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'Password123!ab' });
    expect(unlinkConfirmed.status).toBe(200);
  });
});
