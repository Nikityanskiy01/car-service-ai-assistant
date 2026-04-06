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
      .send({ email, password: 'password123' });
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
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/кирилл/i);
  });

  it('register rejects invalid phone', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'badphone@test.local',
        password: 'password123',
        fullName: 'Test',
        phone: '12',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/телефон/i);
  });
});
