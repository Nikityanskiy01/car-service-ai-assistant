import request from 'supertest';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('auth', () => {
  beforeEach(() => truncateAll());

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
});
