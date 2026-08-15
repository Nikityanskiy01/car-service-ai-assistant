import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../helpers.js';

describe('product events', () => {
  it('accepts funnel event', async () => {
    const res = await request(app).post('/api/product-events').send({ name: 'consult_started', props: { guest: true } });
    expect(res.status).toBe(204);
  });

  it('rejects invalid name', async () => {
    const res = await request(app).post('/api/product-events').send({ name: 'Bad Event' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.headers['content-type']).toMatch(/problem\+json/);
  });
});
