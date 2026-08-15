import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';

describe('GET /api/users/me/summary', () => {
  beforeEach(() => truncateAll());

  it('returns dashboard summary for client', async () => {
    const { token } = await registerClient({ email: 'summary-client@test.local' });

    const res = await request(app)
      .get('/api/users/me/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBeTruthy();
    expect(res.body).toMatchObject({
      activeCasesCount: 0,
      unreadMessagesCount: 0,
      unreadThreads: [],
      hasAnyHistory: false,
      nextBooking: null,
      draftConsultation: null,
      recentActiveCases: [],
    });
  });

  it('returns unread threads with request id and preview', async () => {
    const { token } = await registerClient({ email: 'summary-unread@test.local' });
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    const clientId = me.body.id;

    const session = await prisma.consultationSession.create({
      data: { clientId, status: 'COMPLETED', progressPercent: 100 },
    });
    const requestRow = await prisma.serviceRequest.create({
      data: {
        clientId,
        consultationSessionId: session.id,
        snapshotMake: 'Kia',
        snapshotModel: 'Rio',
        snapshotSymptoms: 'Шум при движении',
        status: 'NEW',
      },
    });

    const hash = await bcrypt.hash('Password123!ab', 8);
    const manager = await prisma.user.create({
      data: {
        email: 'summary-mgr@test.local',
        passwordHash: hash,
        fullName: 'Менеджер',
        phone: '+79990000033',
        role: 'MANAGER',
      },
    });

    await prisma.requestFollowUpMessage.create({
      data: {
        requestId: requestRow.id,
        authorId: manager.id,
        body: 'Можно завтра в 10:00',
      },
    });

    const unread = await request(app)
      .get('/api/users/me/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(unread.status).toBe(200);
    expect(unread.body.unreadMessagesCount).toBe(1);
    expect(unread.body.unreadThreads).toEqual([
      expect.objectContaining({
        requestId: requestRow.id,
        title: 'Kia Rio',
        unreadCount: 1,
        lastMessagePreview: 'Можно завтра в 10:00',
      }),
    ]);

    const listed = await request(app)
      .get('/api/service-requests?pageSize=20')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.find((item) => item.id === requestRow.id)?.unreadCount).toBe(1);

    const opened = await request(app)
      .get(`/api/service-requests/${requestRow.id}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(opened.status).toBe(200);

    const afterRead = await request(app)
      .get('/api/users/me/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(afterRead.status).toBe(200);
    expect(afterRead.body.unreadMessagesCount).toBe(0);
    expect(afterRead.body.unreadThreads).toEqual([]);
  });

  it('shows sent then read ticks after the other party opens the chat', async () => {
    const { token } = await registerClient({ email: 'summary-ticks@test.local' });
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    const clientId = me.body.id;

    const session = await prisma.consultationSession.create({
      data: { clientId, status: 'COMPLETED', progressPercent: 100 },
    });
    const requestRow = await prisma.serviceRequest.create({
      data: {
        clientId,
        consultationSessionId: session.id,
        snapshotMake: 'Kia',
        snapshotModel: 'Rio',
        status: 'NEW',
      },
    });

    await prisma.requestFollowUpMessage.create({
      data: {
        requestId: requestRow.id,
        authorId: clientId,
        body: 'Когда будет готово?',
      },
    });

    const before = await request(app)
      .get(`/api/service-requests/${requestRow.id}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body[0].deliveryStatus).toBe('sent');

    await prisma.serviceRequest.update({
      where: { id: requestRow.id },
      data: { staffMessagesReadAt: new Date() },
    });

    const after = await request(app)
      .get(`/api/service-requests/${requestRow.id}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body[0].deliveryStatus).toBe('read');
  });
});
