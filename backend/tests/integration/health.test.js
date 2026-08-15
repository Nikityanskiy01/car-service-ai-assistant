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

  it('GET /api/ready reports database', async () => {
    const res = await request(app).get('/api/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.db).toBeDefined();
  });

  it('GET /api/health stays compatible', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
  });

  it('GET /api/metrics exposes prometheus text', async () => {
    await request(app).get('/api/live');
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(String(res.text)).toContain('http_requests_total');
  });
});
