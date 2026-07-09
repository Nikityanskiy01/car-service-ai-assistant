import bcrypt from 'bcryptjs';
import request from 'supertest';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function startGuest() {
  const started = await request(app).post('/api/consultations').send({});
  expect(started.status).toBe(201);
  return { sessionId: started.body.id, guestToken: started.body.guestToken };
}

async function sendGuest(sessionId, guestToken, content) {
  return request(app)
    .post(`/api/consultations/${sessionId}/messages`)
    .set('X-Consultation-Guest-Token', guestToken)
    .send({ content });
}

describe('ai consultation access and persistence', () => {
  beforeEach(async () => {
    process.env.LLM_ENABLED = 'false';
    await truncateAll();
  });

  it('persists session/messages/extracted/result and creates guest request with links', async () => {
    const { sessionId, guestToken } = await startGuest();

    const completed = await sendGuest(
      sessionId,
      guestToken,
      'Toyota Camry 2018 пробег 120000. Педаль тормоза проваливается, тормозит хуже, при торможении на скорости.',
    );
    expect(completed.status).toBe(201);
    expect(completed.body.status).toBe('COMPLETED');

    const createReq = await request(app)
      .post(`/api/consultations/${sessionId}/service-request-guest`)
      .set('X-Consultation-Guest-Token', guestToken)
      .send({ fullName: 'Гостевой клиент', phone: '+79990000000', email: null });
    expect(createReq.status).toBe(201);

    const dbSession = await prisma.consultationSession.findUnique({
      where: { id: sessionId },
      include: {
        extracted: true,
        messages: { orderBy: { createdAt: 'asc' } },
        recommendations: true,
        serviceRequest: true,
      },
    });

    expect(dbSession).toBeTruthy();
    expect(dbSession.status).toBe('COMPLETED');
    expect(dbSession.extracted?.make).toBeTruthy();
    expect(dbSession.messages.some((m) => m.sender === 'USER')).toBe(true);
    expect(dbSession.messages.some((m) => m.sender === 'ASSISTANT')).toBe(true);
    expect(dbSession.recommendations.length).toBeGreaterThan(0);
    expect(dbSession.serviceRequest?.consultationSessionId).toBe(sessionId);
  });

  it('enforces guest token and cross-user isolation', async () => {
    const { sessionId, guestToken } = await startGuest();
    await sendGuest(sessionId, guestToken, 'Kia Rio 2019 пробег 90000. Стук на кочках при движении.');

    const noToken = await request(app).get(`/api/consultations/${sessionId}`);
    expect(noToken.status).toBe(401);

    const wrongToken = await request(app)
      .get(`/api/consultations/${sessionId}`)
      .set('X-Consultation-Guest-Token', 'invalid-token');
    expect([401, 403]).toContain(wrongToken.status);

    const { token: ownerToken } = await registerClient({ email: 'owner@test.local' });
    const claim = await request(app)
      .post(`/api/consultations/${sessionId}/claim`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ guestToken });
    expect(claim.status).toBe(200);

    const { token: strangerToken } = await registerClient({ email: 'stranger@test.local' });
    const strangerRead = await request(app)
      .get(`/api/consultations/${sessionId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(strangerRead.status).toBe(403);
  });

  it('allows manager staff visibility but blocks manager posting to consultation', async () => {
    const hash = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        email: 'manager_ai@test.local',
        passwordHash: hash,
        fullName: 'Менеджер ИИ',
        phone: '+70000000002',
        role: 'MANAGER',
      },
    });

    const { token: clientToken } = await registerClient({ email: 'client_ai@test.local' });
    const start = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(start.status).toBe(201);
    const sessionId = start.body.id;

    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager_ai@test.local', password: 'password123' });
    expect(mgrLogin.status).toBe(200);
    const managerToken = mgrLogin.body.accessToken;

    const staffList = await request(app)
      .get('/api/consultations/staff')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(staffList.status).toBe(200);
    expect(staffList.body.items.some((row) => row.id === sessionId)).toBe(true);

    const managerPost = await request(app)
      .post(`/api/consultations/${sessionId}/messages`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ content: 'Ответ менеджера' });
    expect(managerPost.status).toBe(403);
  });
});

