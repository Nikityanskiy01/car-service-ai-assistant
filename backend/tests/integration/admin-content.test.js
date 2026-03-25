import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('admin reference', () => {
  beforeEach(() => truncateAll());

  async function adminToken() {
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
    return login.body.accessToken;
  }

  it('creates category and scenario', async () => {
    const at = await adminToken();

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

  it('full reference CRUD + client active-templates (T041/T043)', async () => {
    const at = await adminToken();

    const sc = await request(app)
      .post('/api/admin/reference/scenarios')
      .set('Authorization', `Bearer ${at}`)
      .send({ title: 'Сценарий для клиента', description: 'x' });
    expect(sc.status).toBe(201);
    const scId = sc.body.id;

    const q = await request(app)
      .post(`/api/admin/reference/scenarios/${scId}/questions`)
      .set('Authorization', `Bearer ${at}`)
      .send({ text: 'Какой пробег?', order: 0 });
    expect(q.status).toBe(201);

    const h = await request(app)
      .post(`/api/admin/reference/scenarios/${scId}/hints`)
      .set('Authorization', `Bearer ${at}`)
      .send({ text: 'Укажите VIN при необходимости', order: 0 });
    expect(h.status).toBe(201);

    const patchQ = await request(app)
      .patch(`/api/admin/reference/questions/${q.body.id}`)
      .set('Authorization', `Bearer ${at}`)
      .send({ text: 'Какой пробег у авто?' });
    expect(patchQ.status).toBe(200);

    const { token: clientTok } = await registerClient({ email: `cl_ref_${Date.now()}@t.test` });
    const tpl = await request(app)
      .get('/api/consultations/context/active-templates')
      .set('Authorization', `Bearer ${clientTok}`);
    expect(tpl.status).toBe(200);
    const found = tpl.body.scenarios.find((s) => s.id === scId);
    expect(found).toBeTruthy();
    expect(found.questions.length).toBeGreaterThanOrEqual(1);
    expect(found.questions[0].text).toContain('пробег');

    const mat = await request(app)
      .post('/api/admin/reference/reference-materials')
      .set('Authorization', `Bearer ${at}`)
      .send({ title: 'Статья', body: 'Текст базы знаний' });
    expect(mat.status).toBe(201);

    const patchMat = await request(app)
      .patch(`/api/admin/reference/reference-materials/${mat.body.id}`)
      .set('Authorization', `Bearer ${at}`)
      .send({ title: 'Статья обновлённая' });
    expect(patchMat.status).toBe(200);

    await request(app)
      .delete(`/api/admin/reference/reference-materials/${mat.body.id}`)
      .set('Authorization', `Bearer ${at}`)
      .expect(204);

    await request(app)
      .delete(`/api/admin/reference/questions/${q.body.id}`)
      .set('Authorization', `Bearer ${at}`)
      .expect(204);

    await request(app)
      .delete(`/api/admin/reference/hints/${h.body.id}`)
      .set('Authorization', `Bearer ${at}`)
      .expect(204);

    await request(app)
      .patch(`/api/admin/reference/scenarios/${scId}`)
      .set('Authorization', `Bearer ${at}`)
      .send({ active: false })
      .expect(200);

    const tpl2 = await request(app)
      .get('/api/consultations/context/active-templates')
      .set('Authorization', `Bearer ${clientTok}`);
    expect(tpl2.body.scenarios.some((s) => s.id === scId)).toBe(false);
  });
});
