import request from 'supertest';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';

export const app = createApp();

/** Очистка БД: совместимо с SQLite и PostgreSQL (без TRUNCATE … CASCADE). */
export async function truncateAll() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.requestFollowUpMessage.deleteMany(),
    prisma.serviceBooking.deleteMany(),
    prisma.consultationReport.deleteMany(),
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
      password: 'password123',
      fullName: 'Тест Клиент',
      phone: '+79990001122',
      ...overrides,
    });
  return { res, email, token: res.body.accessToken };
}

export async function login(email, password = 'password123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { res, token: res.body.accessToken, user: res.body.user };
}
