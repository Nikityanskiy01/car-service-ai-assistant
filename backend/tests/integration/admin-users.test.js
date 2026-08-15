import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, truncateAll } from '../helpers.js';

describe('admin users', () => {
  beforeEach(() => truncateAll());

  it('role change and block; forbidden for non-admin', async () => {
    const hash = await bcrypt.hash('Password123!ab', 8);
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
      .send({ email: 'adm@test.local', password: 'Password123!ab' });
    const at = login.body.accessToken;

    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'vic@test.local', password: 'Password123!ab' });
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
      .send({ email: 'vic@test.local', password: 'Password123!ab' });
    expect(login2.status).toBe(403);

    const audit = await request(app).get('/api/admin/audit-events').set('Authorization', `Bearer ${at}`);
    expect(audit.status).toBe(200);
    const actions = audit.body.map((e) => e.action);
    expect(actions).toContain('USER_ROLE_UPDATE');
    expect(actions).toContain('USER_BLOCKED');
  });

  it('rejects demoting or blocking the last administrator', async () => {
    const hash = await bcrypt.hash('Password123!ab', 8);
    const admin = await prisma.user.create({
      data: {
        email: 'solo-admin@test.local',
        passwordHash: hash,
        fullName: 'Solo',
        phone: '+7',
        role: 'ADMINISTRATOR',
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'solo-admin@test.local', password: 'Password123!ab' });
    const at = login.body.accessToken;

    const demote = await request(app)
      .patch(`/api/admin/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${at}`)
      .send({ role: 'MANAGER' });
    expect(demote.status).toBe(409);

    const block = await request(app)
      .post(`/api/admin/users/${admin.id}/block`)
      .set('Authorization', `Bearer ${at}`);
    expect(block.status).toBe(409);

    const stillAdmin = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stillAdmin.role).toBe('ADMINISTRATOR');
    expect(stillAdmin.blocked).toBe(false);
  });

  it('filters users by role and query', async () => {
    const hash = await bcrypt.hash('Password123!ab', 8);
    await prisma.user.create({
      data: {
        email: 'filter-admin@test.local',
        passwordHash: hash,
        fullName: 'Filter Admin',
        phone: '+8',
        role: 'ADMINISTRATOR',
      },
    });
    await prisma.user.create({
      data: {
        email: 'ivan.manager@test.local',
        passwordHash: hash,
        fullName: 'Иван Менеджер',
        phone: '+9',
        role: 'MANAGER',
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'filter-admin@test.local', password: 'Password123!ab' });
    const at = login.body.accessToken;

    const managers = await request(app)
      .get('/api/admin/users?role=MANAGER')
      .set('Authorization', `Bearer ${at}`);
    expect(managers.status).toBe(200);
    expect(managers.body.every((u) => u.role === 'MANAGER')).toBe(true);

    const search = await request(app)
      .get('/api/admin/users?q=ivan')
      .set('Authorization', `Bearer ${at}`);
    expect(search.status).toBe(200);
    expect(search.body.some((u) => u.email === 'ivan.manager@test.local')).toBe(true);
  });
});
