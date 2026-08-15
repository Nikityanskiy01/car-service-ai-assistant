import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

async function fullServiceRequestForClient(token) {
  const s = await request(app)
    .post('/api/consultations')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  const sid = s.body.id;
  for (let i = 0; i < 6; i++) {
    await request(app)
      .post(`/api/consultations/${sid}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: `x${i}` });
  }
  const sr = await request(app)
    .post(`/api/consultations/${sid}/service-request`)
    .set('Authorization', `Bearer ${token}`);
  return sr.body.id;
}

const tinyPdfBase64 = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');

describe('completion documents', () => {
  beforeEach(() => truncateAll());

  it('manager uploads; client lists and downloads', async () => {
    const hash = await bcrypt.hash('Password123!ab', 8);
    await prisma.user.create({
      data: {
        email: 'mgr-docs@test.local',
        passwordHash: hash,
        fullName: 'Менеджер',
        phone: '+31',
        role: 'MANAGER',
      },
    });

    const { token: clientToken } = await registerClient({ email: 'cl-docs@t.test' });
    const requestId = await fullServiceRequestForClient(clientToken);

    const ml = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mgr-docs@test.local', password: 'Password123!ab' });
    const managerToken = ml.body.accessToken;

    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED' },
    });

    const upload = await request(app)
      .post(`/api/service-requests/${requestId}/completion-documents`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        kind: 'WORK_ORDER',
        fileName: 'zn.pdf',
        mimeType: 'application/pdf',
        contentBase64: tinyPdfBase64,
      });
    expect(upload.status).toBe(201);
    expect(upload.body.kind).toBe('WORK_ORDER');
    expect(upload.body.kindLabel).toBe('Заказ-наряд');

    const clientList = await request(app)
      .get(`/api/service-requests/${requestId}/completion-documents`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientList.status).toBe(200);
    expect(clientList.body.length).toBe(1);

    const docId = clientList.body[0].id;
    const file = await request(app)
      .get(`/api/service-requests/${requestId}/completion-documents/${docId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');

    const inbox = await request(app)
      .get('/api/users/me/notifications')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.items.some((item) => item.kind === 'COMPLETION_DOCUMENTS')).toBe(true);
  });

  it('forbids client upload', async () => {
    const { token: clientToken } = await registerClient({ email: 'cl-only@t.test' });
    const requestId = await fullServiceRequestForClient(clientToken);

    const res = await request(app)
      .post(`/api/service-requests/${requestId}/completion-documents`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        kind: 'RECEIPT',
        fileName: 'check.pdf',
        mimeType: 'application/pdf',
        contentBase64: tinyPdfBase64,
      });
    expect(res.status).toBe(403);
  });
});
