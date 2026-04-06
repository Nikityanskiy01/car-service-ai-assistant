import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('bookings patch + audit (staff)', () => {
  beforeEach(() => truncateAll());

  async function seedBooking() {
    const preferredAt = new Date('2026-06-15T12:00:00.000Z');
    const b = await prisma.serviceBooking.create({
      data: {
        guestName: 'Гость',
        guestPhone: '79991112233',
        preferredAt,
        status: 'PENDING',
        notes: 'Старое',
      },
    });
    return b;
  }

  async function createStaff(email, role) {
    const hash = await bcrypt.hash('password123', 8);
    return prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        fullName: role === 'MANAGER' ? 'Менеджер Иван' : 'Админ Петр',
        phone: '+70000000001',
        role,
      },
    });
  }

  it('PATCH by manager creates audit row; admin reads GET .../audit', async () => {
    const booking = await seedBooking();
    await createStaff('mgr-audit@test.local', 'MANAGER');
    await createStaff('adm-audit@test.local', 'ADMINISTRATOR');

    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-audit@test.local', password: 'password123' });
    const mgrToken = mgrLogin.body.accessToken;

    const patch = await request(app)
      .patch(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ status: 'CONFIRMED', notes: 'Новый комментарий' });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe('CONFIRMED');

    const logs = await prisma.serviceBookingAuditLog.findMany({ where: { bookingId: booking.id } });
    expect(logs.length).toBe(1);
    expect(logs[0].actorId).toBeTruthy();
    const ch = logs[0].changes;
    expect(ch.status).toEqual({ from: 'PENDING', to: 'CONFIRMED' });
    expect(ch.notes.from).toBe('Старое');
    expect(ch.notes.to).toBe('Новый комментарий');

    const admLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm-audit@test.local', password: 'password123' });
    const admToken = admLogin.body.accessToken;

    const auditRes = await request(app)
      .get(`/api/bookings/${booking.id}/audit`)
      .set('Authorization', `Bearer ${admToken}`);
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.body)).toBe(true);
    expect(auditRes.body.length).toBe(1);
    expect(auditRes.body[0].actor.fullName).toMatch(/Менеджер/);
    expect(auditRes.body[0].changes.status).toBeTruthy();
  });

  it('manager cannot GET audit log', async () => {
    const booking = await seedBooking();
    await createStaff('mgr-only@test.local', 'MANAGER');
    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-only@test.local', password: 'password123' });
    const mgrToken = mgrLogin.body.accessToken;

    const auditRes = await request(app)
      .get(`/api/bookings/${booking.id}/audit`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(auditRes.status).toBe(403);
  });

  it('PATCH with no effective changes does not create audit row', async () => {
    const booking = await seedBooking();
    await createStaff('mgr-same@test.local', 'MANAGER');
    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-same@test.local', password: 'password123' });
    const mgrToken = mgrLogin.body.accessToken;

    const patch = await request(app)
      .patch(`/api/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ status: 'PENDING', notes: 'Старое' });
    expect(patch.status).toBe(200);

    const logs = await prisma.serviceBookingAuditLog.findMany({ where: { bookingId: booking.id } });
    expect(logs.length).toBe(0);
  });
});
