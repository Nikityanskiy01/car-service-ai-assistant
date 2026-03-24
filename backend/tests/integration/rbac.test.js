import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('rbac', () => {
  beforeEach(() => truncateAll());

  it('denies manager route for client', async () => {
    const { token } = await registerClient();
    const res = await request(app)
      .get('/api/service-requests')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const res2 = await request(app)
      .patch('/api/service-requests/00000000-0000-4000-8000-000000000099')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 });
    expect(res2.status).toBe(403);
  });

  it('denies admin for client', async () => {
    const { token } = await registerClient();
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows manager list when user is MANAGER', async () => {
    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'mgr@test.local',
        passwordHash: hash,
        fullName: 'M',
        phone: '+1',
        role: 'MANAGER',
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr@test.local', password: 'password123' });
    const res = await request(app)
      .get('/api/service-requests')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
