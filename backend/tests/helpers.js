import request from 'supertest';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';

export const app = createApp();

/** Очистка БД (PostgreSQL): удаление в порядке FK. */
export async function truncateAll() {
  await prisma.$transaction([
    prisma.integrationOutboxEvent.deleteMany(),
    prisma.integrationSyncCursor.deleteMany(),
    prisma.integrationAuditEvent.deleteMany(),
    prisma.integrationConflict.deleteMany(),
    prisma.integrationWebhookEvent.deleteMany(),
    prisma.externalEntityLink.deleteMany(),
    prisma.integrationAttempt.deleteMany(),
    prisma.integrationJob.deleteMany(),
    prisma.integrationStatusMapping.deleteMany(),
    prisma.integrationCredential.deleteMany(),
    prisma.integrationConnection.deleteMany(),
    prisma.contactSubmission.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.requestFollowUpMessage.deleteMany(),
    prisma.serviceBookingAuditLog.deleteMany(),
    prisma.serviceBooking.deleteMany(),
    prisma.consultationReport.deleteMany(),
    prisma.consultationFeedback.deleteMany(),
    prisma.consultationDiagnosisJob.deleteMany(),
    prisma.diagnosticRecommendation.deleteMany(),
    prisma.message.deleteMany(),
    prisma.extractedDiagnosticData.deleteMany(),
    prisma.serviceRequest.deleteMany(),
    prisma.consultationSession.deleteMany(),
    prisma.referenceMaterial.deleteMany(),
    prisma.consultationQuestion.deleteMany(),
    prisma.hint.deleteMany(),
    prisma.consultationScenario.deleteMany(),
    prisma.serviceCategory.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function registerClient(overrides = {}) {
  const email = overrides.email || `c${Date.now()}@t.test`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'Password123!ab',
      fullName: 'Тест Клиент',
      phone: '+79990001122',
      consentPersonalData: true,
      ...overrides,
    });
  return { res, email, token: res.body.accessToken };
}

export async function login(email, password = 'Password123!ab') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { res, token: res.body.accessToken, user: res.body.user };
}
