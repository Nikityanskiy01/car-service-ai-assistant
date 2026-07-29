import crypto from 'crypto';
import request from 'supertest';
import { app, truncateAll } from '../helpers.js';
import prisma from '../../src/lib/prisma.js';
import { encryptSecret, maskSecret } from '../../src/modules/integrations/integrationEncryption.service.js';
import { verifyWebhookHmac } from '../../src/lib/webhookHmac.js';
import { assertSafeOutboundUrl } from '../../src/lib/safeOutboundUrl.js';
import { AppError } from '../../src/lib/errors.js';

describe('security hardening', () => {
  beforeEach(() => truncateAll());

  it('verifyWebhookHmac accepts sha256= hex', () => {
    const secret = 'test-webhook-secret-value';
    const body = Buffer.from('{"ok":true}', 'utf8');
    const hex = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhookHmac(body, `sha256=${hex}`, secret)).toBe(true);
    expect(verifyWebhookHmac(body, hex, secret)).toBe(true);
    expect(verifyWebhookHmac(body, `sha256=${'0'.repeat(64)}`, secret)).toBe(false);
  });

  it('assertSafeOutboundUrl blocks private hosts', () => {
    expect(() => assertSafeOutboundUrl('http://127.0.0.1/x')).toThrow(AppError);
    expect(() => assertSafeOutboundUrl('https://192.168.1.1/x')).toThrow(AppError);
    expect(() => assertSafeOutboundUrl('https://localhost/x')).toThrow(AppError);
    expect(() => assertSafeOutboundUrl('https://example.com/api')).not.toThrow();
  });

  it('demo-login endpoints are removed', async () => {
    const accounts = await request(app).get('/api/auth/demo-accounts');
    expect(accounts.status).toBe(404);
    const login = await request(app).post('/api/auth/demo-login').send({ role: 'ADMINISTRATOR' });
    expect(login.status).toBe(404);
  });

  it('rejects webhook without valid HMAC', async () => {
    const connection = await prisma.integrationConnection.create({
      data: {
        name: 'Test REST',
        provider: 'GENERIC_REST',
        enabled: true,
        status: 'ACTIVE',
        configJson: { baseUrl: 'https://example.com', authType: 'none' },
      },
    });
    await prisma.integrationCredential.create({
      data: {
        connectionId: connection.id,
        key: 'webhookSecret',
        encryptedValue: encryptSecret('super-secret-webhook'),
        maskedValue: maskSecret('super-secret-webhook'),
      },
    });

    const bad = await request(app)
      .post(`/api/webhooks/integrations/${connection.id}`)
      .set('Content-Type', 'application/json')
      .set('X-Signature', 'sha256=' + 'ab'.repeat(32))
      .send({ hello: 'world' });
    expect(bad.status).toBe(401);

    const body = { hello: 'world' };
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac('sha256', 'super-secret-webhook').update(raw).digest('hex');
    const ok = await request(app)
      .post(`/api/webhooks/integrations/${connection.id}`)
      .set('Content-Type', 'application/json')
      .set('X-Signature', `sha256=${sig}`)
      .send(body);
    expect(ok.status).toBe(202);
    expect(ok.body.status).toBe('accepted');
  });
});
