import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../src/lib/prisma.js';
import { app, registerClient, truncateAll } from '../helpers.js';
import { getLastTestEmail, clearLastTestEmail } from '../../src/lib/mail/mail.service.js';
import { clearLastTestTelegram, getLastTestTelegram } from '../../src/modules/notifications/telegramAuth.bot.js';
import { runBookingReminderCheck } from '../../src/jobs/bookingReminders.job.js';

async function createManager() {
  const hash = await bcrypt.hash('Password123!ab', 8);
  await prisma.user.create({
    data: {
      email: 'mgr-notify@test.local',
      passwordHash: hash,
      fullName: 'Менеджер',
      phone: '+79990000001',
      role: 'MANAGER',
    },
  });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'mgr-notify@test.local', password: 'Password123!ab' });
  return login.body.accessToken;
}

async function createClientRequest(token) {
  const s = await request(app).post('/api/consultations').set('Authorization', `Bearer ${token}`).send({});
  const sid = s.body.id;
  for (let i = 0; i < 6; i += 1) {
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

describe('client inbox notifications', () => {
  beforeEach(() => {
    truncateAll();
    clearLastTestEmail();
    clearLastTestTelegram();
  });

  it('returns default preferences and saves channel toggles', async () => {
    const { token } = await registerClient({ email: 'prefs@t.test' });
    const got = await request(app)
      .get('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${token}`);
    expect(got.status).toBe(200);
    expect(got.body.bookingReminders).toBe(true);
    expect(got.body.channelEmail).toBe(true);
    expect(got.body.channels.sms.soon).toBe(true);
    expect(got.body.channels.sms.available).toBe(false);

    const patched = await request(app)
      .patch('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ marketing: true, channelSms: true, channelEmail: false });
    expect(patched.status).toBe(200);
    expect(patched.body.marketing).toBe(true);
    expect(patched.body.channelSms).toBe(true);
    expect(patched.body.channelEmail).toBe(false);
  });

  it('creates inbox + email when manager replies', async () => {
    const { token: ct } = await registerClient({ email: 'cl-n@t.test' });
    const rid = await createClientRequest(ct);
    const mt = await createManager();

    const post = await request(app)
      .post(`/api/service-requests/${rid}/messages`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ body: 'Можно завтра в 11:00' });
    expect(post.status).toBe(201);

    const inbox = await request(app)
      .get('/api/users/me/notifications')
      .set('Authorization', `Bearer ${ct}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.unreadCount).toBe(1);
    expect(inbox.body.items[0].kind).toBe('MANAGER_MESSAGE');
    expect(inbox.body.items[0].body).toContain('завтра');

    const mail = getLastTestEmail();
    expect(mail?.to).toBe('cl-n@t.test');
    expect(mail?.subject).toContain('Сообщение от менеджера');

    const read = await request(app)
      .post('/api/users/me/notifications/read')
      .set('Authorization', `Bearer ${ct}`)
      .send({});
    expect(read.status).toBe(200);
    expect(read.body.unreadCount).toBe(0);
  });

  it('sends telegram when chat is linked and skips SMS until provider is ready', async () => {
    const { token: ct } = await registerClient({ email: 'tg-n@t.test' });
    const user = await prisma.user.findFirst({ where: { email: 'tg-n@t.test' } });
    expect(user).toBeTruthy();
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: '777001' },
    });
    await request(app)
      .patch('/api/users/me/notification-preferences')
      .set('Authorization', `Bearer ${ct}`)
      .send({ channelSms: true });

    const rid = await createClientRequest(ct);
    const mt = await createManager();
    const post = await request(app)
      .post(`/api/service-requests/${rid}/messages`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ body: 'Ответ в Telegram' });
    expect(post.status).toBe(201);

    const tg = getLastTestTelegram();
    expect(tg?.chatId).toBe('777001');
    expect(tg?.text).toContain('Ответ в Telegram');

    const note = await prisma.inboxNotification.findFirst({
      where: { userId: user.id },
      include: { deliveries: true },
    });
    expect(note).toBeTruthy();
    const sms = note.deliveries.find((d) => d.channel === 'SMS');
    expect(sms?.status).toBe('SKIPPED');
    expect(sms?.lastError).toBe('SMS_NOT_CONFIGURED');
  });

  it('creates booking reminder for a visit about a day away', async () => {
    const { token } = await registerClient({ email: 'rem@t.test' });
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    const preferredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const booking = await prisma.serviceBooking.create({
      data: {
        clientId: me.body.id,
        preferredAt,
        status: 'CONFIRMED',
      },
    });

    const sent = await runBookingReminderCheck(new Date());
    expect(sent).toBeGreaterThanOrEqual(1);

    const inbox = await request(app)
      .get('/api/users/me/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(inbox.body.items.some((item) => item.kind === 'BOOKING_REMINDER_DAY')).toBe(true);

    const again = await runBookingReminderCheck(new Date());
    expect(again).toBe(0);
    expect(booking.id).toBeTruthy();
  });
});
