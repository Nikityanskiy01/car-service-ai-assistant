import request from 'supertest';
import { createApp } from '../src/app.js';
import { extractVerificationCodeFromEmail, getLastTestEmail } from '../src/lib/mail/mail.service.js';
import prisma from '../src/lib/prisma.js';
import { assertTestDatabaseConnection } from '../scripts/assert-test-database.mjs';

export const app = createApp();

/** Очистка БД (PostgreSQL): удаление в порядке FK. */
export async function truncateAll() {
  await assertTestDatabaseConnection(prisma);
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
    prisma.consentEvent.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.emailVerificationCode.deleteMany(),
    prisma.authOtpChallenge.deleteMany(),
    prisma.userLoginEvent.deleteMany(),
    prisma.inboxNotificationDelivery.deleteMany(),
    prisma.inboxNotification.deleteMany(),
    prisma.userNotificationPreference.deleteMany(),
    prisma.contactSubmission.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.requestFollowUpAttachment.deleteMany(),
    prisma.requestFollowUpMessage.deleteMany(),
    prisma.serviceBookingAuditLog.deleteMany(),
    prisma.serviceBooking.deleteMany(),
    prisma.vehicleServiceRecord.deleteMany(),
    prisma.clientVehicleExclusion.deleteMany(),
    prisma.clientVehicle.deleteMany(),
    prisma.consultationReport.deleteMany(),
    prisma.serviceRequestCompletionDocument.deleteMany(),
    prisma.consultationFeedback.deleteMany(),
    prisma.consultationCaseEmbedding.deleteMany(),
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

async function verifyRegisteredEmail(email) {
  const mail = getLastTestEmail();
  const code = extractVerificationCodeFromEmail(mail);
  if (!code) throw new Error('Verification code not found in test email');
  const verify = await request(app).post('/api/auth/verify-email').send({ email, code });
  if (verify.status !== 200) {
    throw new Error(`verify-email failed: ${verify.status} ${JSON.stringify(verify.body)}`);
  }
  return verify;
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
  const verify = await verifyRegisteredEmail(email);
  return { res, email, token: verify.body.accessToken };
}

export async function login(email, password = 'Password123!ab') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { res, token: res.body.accessToken, user: res.body.user };
}
