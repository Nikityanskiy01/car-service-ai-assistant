import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('analytics', () => {
  beforeEach(() => truncateAll());

  it('GET /api/analytics/summary — только ADMINISTRATOR', async () => {
    const hash = await bcrypt.hash('Password123!ab', 8);
    await prisma.user.create({
      data: {
        email: 'adm-an@test.local',
        passwordHash: hash,
        fullName: 'Admin',
        phone: '+1',
        role: 'ADMINISTRATOR',
      },
    });
    await prisma.user.create({
      data: {
        email: 'cli-an@test.local',
        passwordHash: hash,
        fullName: 'Client',
        phone: '+2',
        role: 'CLIENT',
      },
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm-an@test.local', password: 'Password123!ab' });
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'cli-an@test.local', password: 'Password123!ab' });

    const deny = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${clientLogin.body.accessToken}`);
    expect(deny.status).toBe(403);

    const ok = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toBeDefined();
  });
});
