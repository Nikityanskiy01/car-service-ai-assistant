import request from 'supertest';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('consultation lifecycle', () => {
  beforeEach(() => truncateAll());

  it('blocks service request until six fields; completes after mock turns', async () => {
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

    for (let i = 0; i < 6; i++) {
      const m = await request(app)
        .post(`/api/consultations/${sid}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: `msg ${i}` });
      expect(m.status).toBe(201);
    }

    const done = await request(app)
      .get(`/api/consultations/${sid}`)
      .set('Authorization', `Bearer ${token}`);
    expect(done.body.extracted?.make).toBeTruthy();
    expect(done.body.extracted?.model).toBeTruthy();

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
});
