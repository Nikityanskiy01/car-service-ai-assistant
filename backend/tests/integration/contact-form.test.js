import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('contact form API', () => {
  beforeEach(() => truncateAll());

  it('POST creates submission without auth', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ fullName: 'Иван', phone: '+7 999 000-11-22', message: 'Здравствуйте' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBeTruthy();
    const row = await prisma.contactSubmission.findUnique({ where: { id: res.body.id } });
    expect(row?.fullName).toBe('Иван');
    expect(row?.phone).toBe('79990001122');
    expect(row?.message).toBe('Здравствуйте');
  });

  it('POST rejects invalid phone', async () => {
    const res = await request(app).post('/api/contact').send({ fullName: 'Иван', phone: '123' });
    expect(res.status).toBe(400);
  });

  it('GET is forbidden for client', async () => {
    const { token } = await registerClient();
    const res = await request(app).get('/api/contact').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET lists for manager', async () => {
    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'mgr-contact@test.local',
        passwordHash: hash,
        fullName: 'Менеджер',
        phone: '+70000000000',
        role: 'MANAGER',
      },
    });
    await request(app).post('/api/contact').send({ fullName: 'Гость', phone: '89991112233' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-contact@test.local', password: 'password123' });
    const mt = login.body.accessToken;

    const list = await request(app).get('/api/contact').set('Authorization', `Bearer ${mt}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBe(1);
    expect(list.body[0].fullName).toBe('Гость');
  });
});
