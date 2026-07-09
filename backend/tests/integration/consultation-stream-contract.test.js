import request from 'supertest';
import { app, truncateAll } from '../helpers.js';

describe('consultation stream contract', () => {
  beforeEach(async () => {
    process.env.LLM_ENABLED = 'false';
    await truncateAll();
  });

  it('returns connected/progress/done events with SSE headers', async () => {
    const started = await request(app).post('/api/consultations').send({});
    expect(started.status).toBe(201);
    const sessionId = started.body.id;
    const guestToken = started.body.guestToken;

    const streamRes = await request(app)
      .post(`/api/consultations/${sessionId}/messages/stream`)
      .set('X-Consultation-Guest-Token', guestToken)
      .set('X-Request-Id', 'stream-contract-test')
      .send({ content: 'Вибрация при торможении на скорости' });

    expect(streamRes.status).toBe(200);
    expect(streamRes.headers['content-type']).toMatch(/text\/event-stream/);
    expect(streamRes.headers['x-request-id']).toBe('stream-contract-test');

    const body = String(streamRes.text || '');
    expect(body).toContain('event: connected');
    expect(body).toContain('event: thinking');
    expect(body).toContain('event: progress');
    expect(body).toContain('event: done');
  });
});

