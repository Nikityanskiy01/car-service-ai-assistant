import request from 'supertest';
import { createApp } from '../src/app.js';
import prisma from '../src/lib/prisma.js';

export const app = createApp();

export async function truncateAll() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      notifications,
      request_follow_up_messages,
      service_bookings,
      consultation_reports,
      service_requests,
      diagnostic_recommendations,
      messages,
      extracted_diagnostic_data,
      consultation_sessions,
      reference_materials,
      consultation_questions,
      hints,
      consultation_scenarios,
      service_categories,
      users
    RESTART IDENTITY CASCADE;
  `);
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
