import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('service request optimistic locking', () => {
  beforeEach(() => truncateAll());

  it('returns 409 on stale expectedVersion', async () => {
    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'mgr4@test.local',
        passwordHash: hash,
        fullName: 'M',
        phone: '+4',
        role: 'MANAGER',
      },
    });

    const { token: ct } = await registerClient({ email: 'cl3@t.test' });
    const s = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${ct}`)
      .send({});
    const sid = s.body.id;
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post(`/api/consultations/${sid}/messages`)
        .set('Authorization', `Bearer ${ct}`)
        .send({ content: `x${i}` });
    }
    const sr = await request(app)
      .post(`/api/consultations/${sid}/service-request`)
      .set('Authorization', `Bearer ${ct}`);
    const rid = sr.body.id;

    const ml = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr4@test.local', password: 'password123' });
    const mt = ml.body.accessToken;

    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/service-requests/${rid}`)
        .set('Authorization', `Bearer ${mt}`)
        .send({ status: 'IN_PROGRESS', expectedVersion: 1 }),
      request(app)
        .patch(`/api/service-requests/${rid}`)
        .set('Authorization', `Bearer ${mt}`)
        .send({ status: 'SCHEDULED', expectedVersion: 1 }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
  });
});
