import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('admin users', () => {
  beforeEach(() => truncateAll());

  it('role change and block; forbidden for non-admin', async () => {
    const hash = await bcrypt.hash('password123', 8);
    await prisma.user.create({
      data: {
        email: 'adm@test.local',
        passwordHash: hash,
        fullName: 'A',
        phone: '+5',
        role: 'ADMINISTRATOR',
      },
    });
    const victim = await prisma.user.create({
      data: {
        email: 'vic@test.local',
        passwordHash: hash,
        fullName: 'V',
        phone: '+6',
        role: 'CLIENT',
      },
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'adm@test.local', password: 'password123' });
    const at = login.body.accessToken;

    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vic@test.local', password: 'password123' });
    const deny = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${clientLogin.body.accessToken}`);
    expect(deny.status).toBe(403);

    const list = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${at}`);
    expect(list.status).toBe(200);

    const role = await request(app)
      .patch(`/api/admin/users/${victim.id}/role`)
      .set('Authorization', `Bearer ${at}`)
      .send({ role: 'MANAGER' });
    expect(role.status).toBe(200);

    await request(app)
      .post(`/api/admin/users/${victim.id}/block`)
      .set('Authorization', `Bearer ${at}`);
    const blocked = await prisma.user.findUnique({ where: { id: victim.id } });
    expect(blocked.blocked).toBe(true);

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vic@test.local', password: 'password123' });
    expect(login2.status).toBe(403);
  });
});
