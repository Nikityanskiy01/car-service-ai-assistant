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
});
