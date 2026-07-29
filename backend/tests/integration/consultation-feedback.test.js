import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function seedManager() {
  const hash = await bcrypt.hash('Password123!ab', 8);
  return prisma.user.create({
    data: {
      email: 'mgr-fb@test.local',
      passwordHash: hash,
      fullName: 'Менеджер FB',
      phone: '+2',
      role: 'MANAGER',
    },
  });
}

describe('consultation feedback', () => {
  beforeEach(() => truncateAll());

  it('manager can upsert feedback and admin sees analytics', async () => {
    await seedManager();
    const { token: clientTok } = await registerClient({ email: 'cl-fb@t.test' });

    const s = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${clientTok}`)
      .send({});
    const sid = s.body.id;
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post(`/api/consultations/${sid}/messages`)
        .set('Authorization', `Bearer ${clientTok}`)
        .send({ content: `msg ${i}` });
    }
    const sr = await request(app)
      .post(`/api/consultations/${sid}/service-request`)
      .set('Authorization', `Bearer ${clientTok}`);
    const rid = sr.body.id;

    const mgrLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-fb@test.local', password: 'Password123!ab' });
    const mt = mgrLogin.body.accessToken;

    const deny = await request(app)
      .put(`/api/service-requests/${rid}/consultation-feedback`)
      .set('Authorization', `Bearer ${clientTok}`)
      .send({ verdict: 'CORRECT' });
    expect(deny.status).toBe(403);

    const bad = await request(app)
      .put(`/api/service-requests/${rid}/consultation-feedback`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ verdict: 'INCORRECT' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .put(`/api/service-requests/${rid}/consultation-feedback`)
      .set('Authorization', `Bearer ${mt}`)
      .send({
        verdict: 'PARTIAL',
        actualCause: 'Износ тормозных колодок',
        worksDone: 'Замена колодок',
      });
    expect(ok.status).toBe(200);
    expect(ok.body.verdict).toBe('PARTIAL');
    expect(ok.body.actualCause).toBe('Износ тормозных колодок');

    const detail = await request(app)
      .get(`/api/service-requests/${rid}`)
      .set('Authorization', `Bearer ${mt}`);
    expect(detail.body.consultationSession.feedback?.verdict).toBe('PARTIAL');

    const hash = await bcrypt.hash('Password123!ab', 8);
    await prisma.user.create({
      data: {
        email: 'adm-fb@test.local',
        passwordHash: hash,
        fullName: 'Admin',
        phone: '+3',
        role: 'ADMINISTRATOR',
      },
    });
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm-fb@test.local', password: 'Password123!ab' });

    const report = await request(app)
      .get('/api/analytics/ai-feedback?days=7')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
    expect(report.status).toBe(200);
    expect(report.body.totalFeedback).toBe(1);
    expect(report.body.usefulPercent).toBe(100);

    const mgrReport = await request(app)
      .get('/api/analytics/ai-feedback?days=7')
      .set('Authorization', `Bearer ${mt}`);
    expect(mgrReport.status).toBe(200);
    expect(mgrReport.body.totalFeedback).toBe(1);

    const csv = await request(app)
      .get('/api/analytics/ai-feedback.csv?days=7')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('useful_percent,100');
  });
});
