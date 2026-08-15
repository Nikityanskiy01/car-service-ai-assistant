import request from 'supertest';
import { app, registerClient, truncateAll } from '../helpers.js';
import prisma from '../../src/lib/prisma.js';
import { dummyOtpToken } from '../../src/lib/otp/otpChallenge.js';
import { generateBackupCodes } from '../../src/lib/totp.js';
import { escapeHtml } from '../../src/lib/htmlEscape.js';
import { assertMagicMime } from '../../src/lib/fileMagic.js';
import { joinSafeUrl } from '../../src/lib/safeOutboundUrl.js';
import { AppError } from '../../src/lib/errors.js';
import { hashGuestToken } from '../../src/lib/guestToken.js';

describe('security sprints', () => {
  beforeEach(() => truncateAll());

  it('OTP dummy token is not a JWT', () => {
    const token = dummyOtpToken();
    expect(token.startsWith('eyJ')).toBe(false);
    expect(token.length).toBeGreaterThan(20);
  });

  it('OTP start uses the same token shape for unknown emails', async () => {
    const res = await request(app).post('/api/auth/otp/start').send({
      channel: 'email',
      email: 'nobody-enum@t.test',
    });
    expect(res.status).toBe(200);
    expect(String(res.body.challengeToken).startsWith('eyJ')).toBe(false);
    expect(res.body.destinationHint).toBeTruthy();
  });

  it('backup codes have more than 32 bits of entropy', () => {
    const [code] = generateBackupCodes(1);
    const hex = String(code).replace(/-/g, '');
    expect(hex.length).toBeGreaterThanOrEqual(20);
  });

  it('stores hashed guest tokens', async () => {
    const started = await request(app).post('/api/consultations').send({});
    expect(started.status).toBe(201);
    const raw = started.body.guestToken;
    expect(raw).toBeTruthy();
    const row = await prisma.consultationSession.findUnique({ where: { id: started.body.id } });
    expect(row.guestToken).toBe(hashGuestToken(raw));
    expect(row.guestToken).not.toBe(raw);
  });

  it('locks account after repeated failed logins', async () => {
    const { email } = await registerClient({ email: 'lockout@t.test' });
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await request(app).post('/api/auth/login').send({ identifier: email, password: 'WrongPass123!ab' });
      expect(last.status).toBe(401);
    }
    const locked = await request(app).post('/api/auth/login').send({ identifier: email, password: 'WrongPass123!ab' });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('rejects absolute URL join for outbound adapters', () => {
    expect(() => joinSafeUrl('https://example.com/api', 'https://evil.example/x')).toThrow(AppError);
    expect(joinSafeUrl('https://example.com/api', '/health')).toContain('example.com');
  });

  it('rejects files whose magic bytes do not match the declared type', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => assertMagicMime(pngHeader, 'image/jpeg')).toThrow(AppError);
    expect(() => assertMagicMime(pngHeader, 'image/png')).not.toThrow();
  });

  it('escapes HTML in mail helpers', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('exports and anonymizes client personal data', async () => {
    const { token } = await registerClient({ email: 'privacy@t.test' });
    const exported = await request(app).get('/api/users/me/privacy/export').set('Authorization', `Bearer ${token}`);
    expect(exported.status).toBe(200);
    expect(exported.body.user.email).toBe('privacy@t.test');

    const deleted = await request(app)
      .post('/api/users/me/privacy/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'Password123!ab' });
    expect(deleted.status).toBe(200);

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  it('does not echo client X-Request-Id', async () => {
    const res = await request(app).get('/api/live').set('X-Request-Id', 'spoofed-id');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-request-id']).not.toBe('spoofed-id');
  });
});
