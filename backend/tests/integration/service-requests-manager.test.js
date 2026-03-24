import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function seedManager() {
  const hash = await bcrypt.hash('password123', 8);
  return prisma.user.create({
    data: {
      email: 'mgr2@test.local',
      passwordHash: hash,
      fullName: 'Менеджер',
      phone: '+2',
      role: 'MANAGER',
    },
  });
}

describe('service requests manager', () => {
  beforeEach(() => truncateAll());

  it('lists, gets detail, patches status with version', async () => {
    await seedManager();
    const { token: clientTok } = await registerClient({ email: 'cl@t.test' });

    const s = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${clientTok}`)
      .send({});
    const sid = s.body.id;
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post(`/api/consultations/${sid}/messages`)
        .set('Authorization', `Bearer ${clientTok}`)
        .send({ content: `x${i}` });
    }
    const sr = await request(app)
      .post(`/api/consultations/${sid}/service-request`)
      .set('Authorization', `Bearer ${clientTok}`);
    const rid = sr.body.id;

    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr2@test.local', password: 'password123' });
    const mt = mgrLogin.body.accessToken;

    const list = await request(app).get('/api/service-requests').set('Authorization', `Bearer ${mt}`);
    expect(list.status).toBe(200);
    expect(list.body.some((r) => r.id === rid)).toBe(true);

    const detail = await request(app)
      .get(`/api/service-requests/${rid}`)
      .set('Authorization', `Bearer ${mt}`);
    expect(detail.status).toBe(200);
    expect(detail.body.client?.phone).toBeTruthy();

    const patch = await request(app)
      .patch(`/api/service-requests/${rid}`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ status: 'IN_PROGRESS', expectedVersion: 1 });
    expect(patch.status).toBe(200);
    expect(patch.body.version).toBe(2);
  });
});
