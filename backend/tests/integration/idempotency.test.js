import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app, truncateAll } from '../helpers.js';

describe('Idempotency-Key', () => {
  beforeEach(() => truncateAll());

  it('replays the same contact POST', async () => {
    const payload = {
      fullName: 'Иван',
      phone: '+7 999 000-11-22',
      message: 'Здравствуйте',
      consentPersonalData: true,
    };
    const first = await request(app).post('/api/contact').set('Idempotency-Key', 'contact-key-1').send(payload);
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/contact').set('Idempotency-Key', 'contact-key-1').send(payload);
    expect(second.status).toBe(201);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body.id).toBe(first.body.id);
  });

  it('rejects the same key with a different payload', async () => {
    const key = 'contact-key-2';
    await request(app)
      .post('/api/contact')
      .set('Idempotency-Key', key)
      .send({
        fullName: 'Иван',
        phone: '+7 999 000-11-22',
        consentPersonalData: true,
      });
    const res = await request(app)
      .post('/api/contact')
      .set('Idempotency-Key', key)
      .send({
        fullName: 'Пётр',
        phone: '+7 999 000-11-22',
        consentPersonalData: true,
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});
