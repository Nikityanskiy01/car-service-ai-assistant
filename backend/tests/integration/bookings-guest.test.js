import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('guest bookings API', () => {
  beforeEach(() => truncateAll());

  it('POST /api/bookings/guest creates booking without auth', async () => {
    const preferredAt = new Date('2026-06-15T12:00:00.000Z').toISOString();
    const res = await request(app).post('/api/bookings/guest').send({
      fullName: 'Гость Иван',
      phone: '+7 999 111-22-33',
      preferredAt,
      serviceTitle: 'Замена масла',
      categoryLabel: 'ТО',
      notes: 'Toyota Camry',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.clientId).toBeNull();
    expect(res.body.guestName).toBe('Гость Иван');
    expect(res.body.guestPhone).toBe('79991112233');
    expect(res.body.notes).toContain('Замена масла');
    expect(res.body.notes).toContain('Toyota Camry');

    const row = await prisma.serviceBooking.findUnique({ where: { id: res.body.id } });
    expect(row?.guestName).toBe('Гость Иван');
    expect(row?.clientId).toBeNull();
  });

  it('GET /api/bookings as manager includes guest booking', async () => {
    const preferredAt = new Date('2026-07-01T10:00:00.000Z').toISOString();
    await request(app).post('/api/bookings/guest').send({
      fullName: 'Пётр',
      phone: '89991234567',
      preferredAt,
    });

    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'mgr-bk-guest@test.local',
        passwordHash: hash,
        fullName: 'Менеджер',
        phone: '+70000000000',
        role: 'MANAGER',
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-bk-guest@test.local', password: 'password123' });
    const mt = login.body.accessToken;

    const list = await request(app).get('/api/bookings').set('Authorization', `Bearer ${mt}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].guestName).toBe('Пётр');
    expect(list.body[0].guestPhone).toBe('79991234567');
  });

  it('POST rejects invalid phone', async () => {
    const res = await request(app)
      .post('/api/bookings/guest')
      .send({
        fullName: 'X',
        phone: '12',
        preferredAt: '2026-06-15T12:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });

  it('POST rejects preferredAt outside 9–21 MSK', async () => {
    const res = await request(app).post('/api/bookings/guest').send({
      fullName: 'Ночь',
      phone: '+7 999 000-11-22',
      preferredAt: '2026-06-01T18:00:00.000Z',
    });
    expect(res.status).toBe(400);
    expect(String(res.body?.error || '')).toMatch(/9:00|21:00|московск/i);
  });
});
