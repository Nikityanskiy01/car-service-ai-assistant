import request from 'supertest';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('telegram notification row', () => {
  beforeEach(() => truncateAll());

  it('creates Notification after service request', async () => {
    const { token } = await registerClient();
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
    expect(sr.status).toBe(201);

    const notes = await prisma.notification.findMany({
      where: { serviceRequestId: sr.body.id },
    });
    expect(notes.length).toBe(1);
    expect(notes[0].payload).toContain('NEW_SERVICE_REQUEST');
  });
});
