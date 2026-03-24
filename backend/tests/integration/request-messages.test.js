import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function fullServiceRequestForClient(token) {
  const s = await request(app)
    .post('/api/consultations')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  const sid = s.body.id;
  for (let i = 0; i < 6; i++) {
    await request(app)
      .post(`/api/consultations/${sid}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: `x${i}` });
  }
  const sr = await request(app)
    .post(`/api/consultations/${sid}/service-request`)
    .set('Authorization', `Bearer ${token}`);
  return sr.body.id;
}

describe('request follow-up messages', () => {
  beforeEach(() => truncateAll());

  it('posts and lists; blocks when completed', async () => {
    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'mgr3@test.local',
        passwordHash: hash,
        fullName: 'M',
        phone: '+3',
        role: 'MANAGER',
      },
    });

    const { token: ct } = await registerClient({ email: 'cl2@t.test' });
    const rid = await fullServiceRequestForClient(ct);

    const ml = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr3@test.local', password: 'password123' });
    const mt = ml.body.accessToken;

    const p1 = await request(app)
      .post(`/api/service-requests/${rid}/messages`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ body: 'Здравствуйте, уточните время' });
    expect(p1.status).toBe(201);

    const g = await request(app)
      .get(`/api/service-requests/${rid}/messages`)
      .set('Authorization', `Bearer ${ct}`);
    expect(g.status).toBe(200);
    expect(g.body.length).toBeGreaterThanOrEqual(1);

    await prisma.serviceRequest.update({
      where: { id: rid },
      data: { status: 'COMPLETED' },
    });

    const p2 = await request(app)
      .post(`/api/service-requests/${rid}/messages`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ body: 'ещё' });
    expect(p2.status).toBe(409);
  });
});
