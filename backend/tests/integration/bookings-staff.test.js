import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function seedManager() {
  const hash = await bcrypt.hash('Password123!ab', 8);
  await prisma.user.create({
    data: {
      email: 'mgr-staff-bk@test.local',
      passwordHash: hash,
      fullName: 'Менеджер',
      phone: '+70000000002',
      role: 'MANAGER',
    },
  });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'mgr-staff-bk@test.local', password: 'Password123!ab' });
  return login.body.accessToken;
}

async function createClientRequest(email) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error('client not found');
  const session = await prisma.consultationSession.create({
    data: { clientId: user.id, status: 'COMPLETED', progressPercent: 100 },
  });
  const row = await prisma.serviceRequest.create({
    data: {
      clientId: user.id,
      consultationSessionId: session.id,
      snapshotMake: 'Toyota',
      snapshotModel: 'Camry',
      snapshotSymptoms: 'Стук при торможении',
      status: 'IN_PROGRESS',
    },
  });
  return { requestId: row.id, clientId: user.id };
}

describe('staff bookings API', () => {
  beforeEach(() => truncateAll());

  it('POST /api/bookings as manager creates PENDING booking the client can see', async () => {
    const { token: clientTok, email } = await registerClient({ email: 'cl-staff-bk@t.test' });
    const { requestId } = await createClientRequest(email);
    const mt = await seedManager();
    const preferredAt = new Date('2026-09-15T12:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${mt}`)
      .send({ preferredAt, serviceRequestId: requestId, notes: 'Согласовать по телефону' });

    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING');
    expect(created.body.serviceRequestId).toBe(requestId);
    expect(created.body.clientId).toBeTruthy();
    expect(created.body.notes).toBe('Согласовать по телефону');

    const list = await request(app).get('/api/bookings').set('Authorization', `Bearer ${clientTok}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0].status).toBe('PENDING');

    const inbox = await request(app)
      .get('/api/users/me/notifications')
      .set('Authorization', `Bearer ${clientTok}`);
    expect(inbox.status).toBe(200);
    const createdNote = inbox.body.items.find((row) => row.kind === 'BOOKING_CREATED');
    expect(createdNote).toBeTruthy();
    expect(createdNote.title).toBe('Предложено время визита');
    expect(createdNote.body).toMatch(/соглас/i);
  });

  it('POST /api/bookings as manager requires a service request', async () => {
    const mt = await seedManager();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${mt}`)
      .send({ preferredAt: new Date('2026-09-16T12:00:00.000Z').toISOString() });
    expect(res.status).toBe(400);
  });

  it('POST /api/bookings as manager links guest request without client account', async () => {
    const mt = await seedManager();
    const session = await prisma.consultationSession.create({
      data: { guestName: 'Гость Анна', guestPhone: '79993334455', status: 'COMPLETED', progressPercent: 100 },
    });
    const requestRow = await prisma.serviceRequest.create({
      data: {
        guestName: 'Гость Анна',
        guestPhone: '79993334455',
        guestEmail: 'anna-guest@t.test',
        consultationSessionId: session.id,
        snapshotMake: 'Lada',
        snapshotModel: 'Vesta',
        status: 'IN_PROGRESS',
      },
    });

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${mt}`)
      .send({
        preferredAt: new Date('2026-09-17T12:00:00.000Z').toISOString(),
        serviceRequestId: requestRow.id,
      });

    expect(created.status).toBe(201);
    expect(created.body.clientId).toBeNull();
    expect(created.body.guestName).toBe('Гость Анна');
    expect(created.body.guestPhone).toBe('79993334455');
    expect(created.body.status).toBe('PENDING');
  });

  it('POST /api/bookings as manager rejects closed requests', async () => {
    const { email } = await registerClient({ email: 'cl-closed-bk@t.test' });
    const { requestId } = await createClientRequest(email);
    await prisma.serviceRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
    const mt = await seedManager();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${mt}`)
      .send({
        preferredAt: new Date('2026-09-18T12:00:00.000Z').toISOString(),
        serviceRequestId: requestId,
      });
    expect(res.status).toBe(400);
  });
});
