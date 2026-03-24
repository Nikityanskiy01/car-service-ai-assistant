import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('admin reference', () => {
  beforeEach(() => truncateAll());

  it('creates category and scenario', async () => {
    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'adm2@test.local',
        passwordHash: hash,
        fullName: 'A',
        phone: '+7',
        role: 'ADMINISTRATOR',
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm2@test.local', password: 'password123' });
    const at = login.body.accessToken;

    const cat = await request(app)
      .post('/api/admin/reference/service-categories')
      .set('Authorization', `Bearer ${at}`)
      .send({ name: 'Ремонт ДВС', description: 'Двигатель' });
    expect(cat.status).toBe(201);

    const sc = await request(app)
      .post('/api/admin/reference/scenarios')
      .set('Authorization', `Bearer ${at}`)
      .send({ title: 'Сценарий тест', description: 'd' });
    expect(sc.status).toBe(201);

    const list = await request(app)
      .get('/api/admin/reference/scenarios')
      .set('Authorization', `Bearer ${at}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
  });
});
