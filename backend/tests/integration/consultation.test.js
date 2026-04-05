import request from 'supertest';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('consultation lifecycle', () => {
  beforeEach(() => truncateAll());

  it('blocks service request until mandatory fields; completes after rule+extraction turns', async () => {
    const { token } = await registerClient();

    const start = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(start.status).toBe(201);
    const sid = start.body.id;

    const early = await request(app)
      .post(`/api/consultations/${sid}/service-request`)
      .set('Authorization', `Bearer ${token}`);
    expect(early.status).toBe(400);

    const steps = ['Пробег 120000', 'Плавают обороты', 'При движении'];
    for (const content of steps) {
      const m = await request(app)
        .post(`/api/consultations/${sid}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content });
      expect(m.status).toBe(201);
    }

    const done = await request(app)
      .get(`/api/consultations/${sid}`)
      .set('Authorization', `Bearer ${token}`);
    expect(done.body.extracted?.mileage).toBeTruthy();
    expect(done.body.extracted?.symptoms).toBeTruthy();
    expect(done.body.extracted?.problemConditions).toBeTruthy();
    expect(done.body.status).toBe('COMPLETED');

    const req = await request(app)
      .post(`/api/consultations/${sid}/service-request`)
      .set('Authorization', `Bearer ${token}`);
    expect(req.status).toBe(201);
    expect(req.body.status).toBe('NEW');

    const report = await request(app)
      .post(`/api/consultations/${sid}/report`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Мой отчёт' });
    expect(report.status).toBe(201);

    const reports = await request(app)
      .get('/api/users/me/consultation-reports')
      .set('Authorization', `Bearer ${token}`);
    expect(reports.status).toBe(200);
    expect(reports.body.length).toBeGreaterThanOrEqual(1);
  });

  it('guest starts consultation without JWT; claim links session after register', async () => {
    const guestStart = await request(app).post('/api/consultations').send({});
    expect(guestStart.status).toBe(201);
    expect(guestStart.body.guestToken).toBeTruthy();
    expect(guestStart.body.isGuest).toBe(true);
    const sid = guestStart.body.id;
    const gt = guestStart.body.guestToken;

    const g0 = await request(app).get(`/api/consultations/${sid}`).set('X-Consultation-Guest-Token', gt);
    expect(g0.status).toBe(200);
    expect(g0.body.messages?.length).toBeGreaterThanOrEqual(1);

    const m1 = await request(app)
      .post(`/api/consultations/${sid}/messages`)
      .set('X-Consultation-Guest-Token', gt)
      .send({ content: 'Тестовое сообщение гостя' });
    expect(m1.status).toBe(201);

    const { token } = await registerClient();
    const badClaim = await request(app)
      .post(`/api/consultations/${sid}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ guestToken: 'wrong-token' });
    expect(badClaim.status).toBe(403);

    const claim = await request(app)
      .post(`/api/consultations/${sid}/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ guestToken: gt });
    expect(claim.status).toBe(200);
    expect(claim.body.isGuest).toBe(false);

    const owned = await request(app).get(`/api/consultations/${sid}`).set('Authorization', `Bearer ${token}`);
    expect(owned.status).toBe(200);
  });
});
