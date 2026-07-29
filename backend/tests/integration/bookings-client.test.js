import request from 'supertest';
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
});
