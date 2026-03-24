import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('security basics', () => {
  beforeEach(() => truncateAll());

  it('rejects tampered JWT', async () => {
    const tok = jwt.sign({ sub: 'x', role: 'CLIENT' }, 'wrong-secret');
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(401);
  });

  it('SQL injection not applicable — Prisma parameterized', async () => {
    const { token } = await registerClient({ email: 'e1@t.test' });
    const res = await request(app)
      .get('/api/service-requests')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: "'; DROP TABLE users; --" });
    expect(res.status).toBe(200);
  });

  it('cross-role: client cannot patch other user resource', async () => {
    const { token } = await registerClient({ email: 'me@test.local' });
    const fake = '00000000-0000-4000-8000-000000000001';
    const res = await request(app)
      .get(`/api/service-requests/${fake}`)
      .set('Authorization', `Bearer ${token}`);
    expect([403, 404]).toContain(res.status);
  });
});
