import request from 'supertest';
import { app, truncateAll } from '../helpers.js';

async function startGuest() {
  const started = await request(app).post('/api/consultations').send({});
  expect(started.status).toBe(201);
  return { sessionId: started.body.id, guestToken: started.body.guestToken };
}

describe('ai observability and stability', () => {
  beforeEach(async () => {
    process.env.LLM_ENABLED = 'false';
    await truncateAll();
  });

  it('propagates request id header for correlation', async () => {
    const reqId = 'ai-test-correlation-id';
    const res = await request(app).post('/api/consultations').set('X-Request-Id', reqId).send({});
    expect(res.status).toBe(201);
    expect(res.headers['x-request-id']).toBe(reqId);

    const generated = await request(app).post('/api/consultations').send({});
    expect(generated.status).toBe(201);
    expect(typeof generated.headers['x-request-id']).toBe('string');
    expect(generated.headers['x-request-id'].length).toBeGreaterThan(8);
  });

  it('handles parallel guest consultations without cross-session leaks', async () => {
    const sessions = await Promise.all(Array.from({ length: 5 }).map(() => startGuest()));
    const results = await Promise.all(
      sessions.map(({ sessionId, guestToken }, i) =>
        request(app)
          .post(`/api/consultations/${sessionId}/messages`)
          .set('X-Consultation-Guest-Token', guestToken)
          .send({
            content: `Toyota Camry 2018 пробег ${120000 + i * 1000}. Вибрация при торможении, при движении.`,
          }),
      ),
    );

    for (const res of results) {
      expect(res.status).toBe(201);
      expect(res.body.extracted?.make).toBeTruthy();
    }
    const ids = new Set(results.map((r) => r.body.id));
    expect(ids.size).toBe(5);
  });
});

