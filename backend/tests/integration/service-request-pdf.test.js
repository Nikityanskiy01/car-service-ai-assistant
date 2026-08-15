import request from 'supertest';
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

describe('service request PDF export', () => {
  beforeEach(() => truncateAll());

  it('returns application/pdf for client', async () => {
    const { token } = await registerClient({ email: 'pdf-client@t.test' });
    const requestId = await fullServiceRequestForClient(token);

    const res = await request(app)
      .get(`/api/service-requests/${requestId}/export.pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.length).toBeGreaterThan(100);
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });
});
