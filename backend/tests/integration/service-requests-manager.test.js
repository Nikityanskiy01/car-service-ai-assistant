import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function seedManager() {
  const hash = await bcrypt.hash('Password123!ab', 8);
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
      .send({ email: 'mgr2@test.local', password: 'Password123!ab' });
    const mt = mgrLogin.body.accessToken;

    const list = await request(app).get('/api/service-requests').set('Authorization', `Bearer ${mt}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((r) => r.id === rid)).toBe(true);

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

  it('lists registered and guest clients without overflowing pageSize', async () => {
    const { token: clientTok } = await registerClient({
      email: 'cl-list@t.test',
      fullName: 'Анна Ковалева',
      phone: '+79991110001',
    });
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${clientTok}`);
    const clientId = me.body.id;

    const clientSession = await prisma.consultationSession.create({
      data: { clientId, status: 'COMPLETED', progressPercent: 100 },
    });
    await prisma.serviceRequest.create({
      data: {
        clientId,
        consultationSessionId: clientSession.id,
        snapshotMake: 'Kia',
        snapshotModel: 'Rio',
        status: 'NEW',
      },
    });

    const guestSession = await prisma.consultationSession.create({
      data: { guestName: 'Игорь Петров', guestPhone: '79992220002', status: 'COMPLETED', progressPercent: 100 },
    });
    await prisma.serviceRequest.create({
      data: {
        guestName: 'Игорь Петров',
        guestPhone: '79992220002',
        consultationSessionId: guestSession.id,
        snapshotMake: 'Ford',
        snapshotModel: 'Focus',
        status: 'IN_PROGRESS',
      },
    });

    await seedManager();
    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr2@test.local', password: 'Password123!ab' });
    const mt = mgrLogin.body.accessToken;

    const tooBig = await request(app)
      .get('/api/service-requests?pageSize=200')
      .set('Authorization', `Bearer ${mt}`);
    expect(tooBig.status).toBe(400);

    const list = await request(app)
      .get('/api/service-requests/clients?pageSize=20&sort=name')
      .set('Authorization', `Bearer ${mt}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((row) => row.clientId === clientId && row.name === 'Анна Ковалева')).toBe(true);
    expect(list.body.items.some((row) => row.isGuest && row.phone === '79992220002')).toBe(true);

    const guests = await request(app)
      .get('/api/service-requests/clients?filter=guests')
      .set('Authorization', `Bearer ${mt}`);
    expect(guests.status).toBe(200);
    expect(guests.body.items.every((row) => row.isGuest)).toBe(true);
  });

  it('returns kanban board columns with per-status totals beyond pageSize', async () => {
    await seedManager();
    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr2@test.local', password: 'Password123!ab' });
    const mt = mgrLogin.body.accessToken;

    for (let i = 0; i < 3; i++) {
      const session = await prisma.consultationSession.create({
        data: { guestName: `Гость ${i}`, guestPhone: `7999000000${i}`, status: 'COMPLETED', progressPercent: 100 },
      });
      await prisma.serviceRequest.create({
        data: {
          guestName: `Гость ${i}`,
          guestPhone: `7999000000${i}`,
          consultationSessionId: session.id,
          snapshotMake: 'Kia',
          snapshotModel: 'Rio',
          status: 'NEW',
        },
      });
    }
    const progressSession = await prisma.consultationSession.create({
      data: { guestName: 'В работе', guestPhone: '79991112233', status: 'COMPLETED', progressPercent: 100 },
    });
    await prisma.serviceRequest.create({
      data: {
        guestName: 'В работе',
        guestPhone: '79991112233',
        consultationSessionId: progressSession.id,
        snapshotMake: 'Ford',
        snapshotModel: 'Focus',
        status: 'IN_PROGRESS',
      },
    });

    const tooBig = await request(app)
      .get('/api/service-requests/board?pageSize=80')
      .set('Authorization', `Bearer ${mt}`);
    expect(tooBig.status).toBe(400);

    const board = await request(app)
      .get('/api/service-requests/board?pageSize=2')
      .set('Authorization', `Bearer ${mt}`);
    expect(board.status).toBe(200);
    expect(board.body.columns.NEW.items).toHaveLength(2);
    expect(board.body.columns.NEW.total).toBe(3);
    expect(board.body.columns.IN_PROGRESS.total).toBe(1);
    expect(board.body.columns.IN_PROGRESS.items).toHaveLength(1);
    expect(board.body.total).toBe(4);
  });
});
