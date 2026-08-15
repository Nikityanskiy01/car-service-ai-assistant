import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../helpers.js';

describe('health probes', () => {
  it('GET /api/live does not require database', async () => {
    const res = await request(app).get('/api/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
    expect(typeof res.body.uptimeSec).toBe('number');
  });

  it('GET /api/ready does not leak dependency details', async () => {
    const res = await request(app).get('/api/ready');
    expect([200, 503]).toContain(res.status);
    expect(['ready', 'not_ready']).toContain(res.body.status);
    expect(res.body.checks).toBeUndefined();
    expect(res.body.db).toBeUndefined();
    expect(res.body.redis).toBeUndefined();
  });

  it('GET /api/health stays compatible', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(res.body.db).toBeUndefined();
    expect(res.body.redis).toBeUndefined();
    expect(res.body.checks).toBeUndefined();
  });

  it('GET /api/metrics is closed without a token', async () => {
    await request(app).get('/api/live');
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
