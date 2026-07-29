import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('admin ai memory', () => {
  beforeEach(() => truncateAll());

  async function adminToken() {
    const hash = await bcrypt.hash('Password123!ab', 8);
    await prisma.user.create({
      data: {
        email: 'adm_mem@test.local',
        passwordHash: hash,
        fullName: 'Admin',
        phone: '+7',
        role: 'ADMINISTRATOR',
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm_mem@test.local', password: 'Password123!ab' });
    return login.body.accessToken;
  }

  it('returns stats and accepts search/backfill', async () => {
    const at = await adminToken();

    const stats = await request(app)
      .get('/api/admin/ai/memory/stats')
      .set('Authorization', `Bearer ${at}`);
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({
      indexedSessions: expect.any(Number),
      completedSessions: expect.any(Number),
    });

    const search = await request(app)
      .post('/api/admin/ai/memory/search')
      .set('Authorization', `Bearer ${at}`)
      .send({ symptoms: 'стук при торможении', make: 'BMW' });
    expect(search.status).toBe(200);
    expect(Array.isArray(search.body.results)).toBe(true);

    const backfill = await request(app)
      .post('/api/admin/ai/memory/backfill')
      .set('Authorization', `Bearer ${at}`)
      .send({ limit: 5, dryRun: true });
    expect(backfill.status).toBe(200);
    expect(backfill.body.dryRun).toBe(true);
  });
});
