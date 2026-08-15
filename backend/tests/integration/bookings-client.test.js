import request from 'supertest';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('client bookings API', () => {
  beforeEach(() => truncateAll());

  it('POST /api/bookings creates booking linked to client account', async () => {
    const { token } = await registerClient({ email: 'client-bk@test.local' });
    const preferredAt = new Date('2026-06-15T12:00:00.000Z').toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        preferredAt,
        notes: 'После ИИ-диагностики',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.clientId).toBeTruthy();
    expect(res.body.notes).toBe('После ИИ-диагностики');

    const list = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(res.body.id);
  });

  it('POST /api/bookings links booking to garage vehicle', async () => {
    const { token } = await registerClient({ email: 'client-bk-car@test.local' });
    const vehicle = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ make: 'Renault', model: 'Duster', year: 2018 });
    expect(vehicle.status).toBe(201);

    const preferredAt = new Date('2026-06-19T12:00:00.000Z').toISOString();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        preferredAt,
        vehicleId: vehicle.body.id,
        notes: 'Запись с карточки гаража',
      });

    expect(res.status).toBe(201);
    expect(res.body.vehicleId).toBe(vehicle.body.id);
    expect(res.body.vehicle).toMatchObject({ make: 'Renault', model: 'Duster' });
  });

  it('POST /api/bookings rejects someone else vehicle', async () => {
    const owner = await registerClient({ email: 'client-bk-owner@test.local' });
    const other = await registerClient({ email: 'client-bk-other@test.local' });
    const vehicle = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ make: 'Toyota', model: 'Camry' });
    expect(vehicle.status).toBe(201);

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${other.token}`)
      .send({
        preferredAt: new Date('2026-06-21T12:00:00.000Z').toISOString(),
        vehicleId: vehicle.body.id,
      });

    expect(res.status).toBe(400);
  });

  it('GET /api/bookings/:id returns own booking', async () => {
    const { token } = await registerClient({ email: 'client-bk-get@test.local' });
    const preferredAt = new Date('2026-06-16T12:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt, notes: 'Тест' });

    const res = await request(app)
      .get(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.notes).toBe('Тест');
  });

  it('PATCH /api/bookings/:id allows client to cancel own booking', async () => {
    const { token } = await registerClient({ email: 'client-bk-cancel@test.local' });
    const preferredAt = new Date('2026-06-17T12:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt });

    const res = await request(app)
      .patch(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('PATCH /api/bookings/:id rejects non-cancel fields for client', async () => {
    const { token } = await registerClient({ email: 'client-bk-patch@test.local' });
    const preferredAt = new Date('2026-06-18T12:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt });

    const res = await request(app)
      .patch(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'hack' });

    expect(res.status).toBe(400);
  });

  it('PATCH /api/bookings/:id allows client to reschedule own booking', async () => {
    const { token } = await registerClient({ email: 'client-bk-move@test.local' });
    const preferredAt = new Date('2026-09-18T12:00:00.000Z').toISOString();
    const nextAt = new Date('2026-09-20T12:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt });

    const res = await request(app)
      .patch(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt: nextAt });

    expect(res.status).toBe(200);
    expect(res.body.preferredAt).toBe(nextAt);
    expect(res.body.status).toBe('PENDING');
  });

  it('PATCH reschedule returns confirmed booking to pending', async () => {
    const { token } = await registerClient({ email: 'client-bk-reconfirm@test.local' });
    const preferredAt = new Date('2026-09-22T12:00:00.000Z').toISOString();
    const nextAt = new Date('2026-09-24T10:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt });

    await prisma.serviceBooking.update({
      where: { id: created.body.id },
      data: { status: 'CONFIRMED' },
    });

    const res = await request(app)
      .patch(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt: nextAt });

    expect(res.status).toBe(200);
    expect(res.body.preferredAt).toBe(nextAt);
    expect(res.body.status).toBe('PENDING');
  });

  it('PATCH reschedule rejects cancelled booking and hours outside 9–21 MSK', async () => {
    const { token } = await registerClient({ email: 'client-bk-move-bad@test.local' });
    const preferredAt = new Date('2026-09-26T12:00:00.000Z').toISOString();

    const created = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt });

    const cancelled = await request(app)
      .patch(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);

    const moveCancelled = await request(app)
      .patch(`/api/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt: new Date('2026-09-28T12:00:00.000Z').toISOString() });
    expect(moveCancelled.status).toBe(400);

    const live = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt: new Date('2026-09-27T12:00:00.000Z').toISOString() });

    const outsideHours = await request(app)
      .patch(`/api/bookings/${live.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferredAt: '2026-09-29T18:00:00.000Z' });
    expect(outsideHours.status).toBe(400);
  });
});
