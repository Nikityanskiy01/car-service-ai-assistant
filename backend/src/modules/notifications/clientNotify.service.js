import prisma from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { isSmtpConfigured, sendNotificationEmail } from '../../lib/mail/mail.service.js';
import { trySendNotificationSms } from '../../lib/sms/sms.service.js';
import { isTelegramConfigured, sendTelegramMessage } from './telegramAuth.bot.js';

export const DEFAULT_PREFS = {
  bookingReminders: true,
  messageAlerts: true,
  marketing: false,
  channelEmail: true,
  channelTelegram: true,
  channelSms: false,
};

const TOPIC_BY_KIND = {
  BOOKING_CREATED: 'bookingReminders',
  BOOKING_CONFIRMED: 'bookingReminders',
  BOOKING_CANCELLED: 'bookingReminders',
  BOOKING_RESCHEDULED: 'bookingReminders',
  BOOKING_REMINDER_DAY: 'bookingReminders',
  BOOKING_REMINDER_HOUR: 'bookingReminders',
  MANAGER_MESSAGE: 'messageAlerts',
  MARKETING: 'marketing',
  COMPLETION_DOCUMENTS: 'messageAlerts',
};

export function formatWhenMsk(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function topicEnabled(prefs, kind) {
  const key = TOPIC_BY_KIND[kind];
  if (!key) return false;
  return Boolean(prefs[key]);
}

function toPrefs(row) {
  if (!row) return { ...DEFAULT_PREFS };
  return {
    bookingReminders: row.bookingReminders,
    messageAlerts: row.messageAlerts,
    marketing: row.marketing,
    channelEmail: row.channelEmail,
    channelTelegram: row.channelTelegram,
    channelSms: row.channelSms,
  };
}

export async function getOrCreatePrefs(userId) {
  const existing = await prisma.userNotificationPreference.findUnique({ where: { userId } });
  if (existing) return toPrefs(existing);
  const created = await prisma.userNotificationPreference.create({
    data: { userId },
  });
  return toPrefs(created);
}

export async function updatePrefs(userId, patch) {
  await getOrCreatePrefs(userId);
  const data = {};
  if (patch.bookingReminders != null) data.bookingReminders = Boolean(patch.bookingReminders);
  if (patch.messageAlerts != null) data.messageAlerts = Boolean(patch.messageAlerts);
  if (patch.marketing != null) data.marketing = Boolean(patch.marketing);
  if (patch.channelEmail != null) data.channelEmail = Boolean(patch.channelEmail);
  if (patch.channelTelegram != null) data.channelTelegram = Boolean(patch.channelTelegram);
  if (patch.channelSms != null) data.channelSms = Boolean(patch.channelSms);
  const row = await prisma.userNotificationPreference.update({
    where: { userId },
    data,
  });
  return toPrefs(row);
}

async function recordDelivery(notificationId, channel, result) {
  await prisma.inboxNotificationDelivery.create({
    data: {
      notificationId,
      channel,
      status: result.status,
      lastError: result.error || null,
    },
  });
}

async function deliverEmail(user, payload) {
  const env = getEnv();
  const to = String(user.emailProfile || user.email || '').trim();
  if (!to) return { status: 'SKIPPED', error: 'NO_EMAIL' };
  if (env.NODE_ENV !== 'test' && !isSmtpConfigured()) {
    return { status: 'SKIPPED', error: 'SMTP_NOT_CONFIGURED' };
  }
  try {
    await sendNotificationEmail({
      to,
      title: payload.title,
      body: payload.body,
      href: payload.href,
      userName: user.fullName,
    });
    return { status: 'SENT' };
  } catch (e) {
    logger.warn({ err: e, userId: user.id }, 'notification email failed');
    return { status: 'FAILED', error: String(e.message || e).slice(0, 2000) };
  }
}

async function deliverTelegram(user, payload) {
  const chatId = user.telegramChatId;
  if (!chatId) return { status: 'SKIPPED', error: 'TELEGRAM_NOT_LINKED' };
  const env = getEnv();
  if (env.NODE_ENV !== 'test' && !isTelegramConfigured()) {
    return { status: 'SKIPPED', error: 'TELEGRAM_NOT_CONFIGURED' };
  }
  try {
    const href = payload.href
      ? `\n${String(getEnv().APP_PUBLIC_URL || '').replace(/\/$/, '')}${payload.href}`
      : '';
    await sendTelegramMessage(chatId, `${payload.title}\n${payload.body}${href}`);
    return { status: 'SENT' };
  } catch (e) {
    logger.warn({ err: e, userId: user.id }, 'notification telegram failed');
    const code = e?.code || '';
    if (code === 'TELEGRAM_NOT_CONFIGURED') {
      return { status: 'SKIPPED', error: 'TELEGRAM_NOT_CONFIGURED' };
    }
    return { status: 'FAILED', error: String(e.message || e).slice(0, 2000) };
  }
}

async function deliverSms(user, payload) {
  const phone = String(user.phone || '').replace(/\D/g, '');
  if (!phone) return { status: 'SKIPPED', error: 'NO_PHONE' };
  const text = `${payload.title}: ${payload.body}`.slice(0, 300);
  return trySendNotificationSms({ to: phone, text });
}

/**
 * Создаёт уведомление в кабинете и рассылает по включённым каналам.
 * @param {string} userId
 * @param {{ kind: string; title: string; body: string; href?: string | null; dedupeKey: string }} payload
 */
export async function notifyClient(userId, payload) {
  if (!userId) return null;
  const prefs = await getOrCreatePrefs(userId);
  if (!topicEnabled(prefs, payload.kind)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailProfile: true,
      fullName: true,
      phone: true,
      telegramChatId: true,
    },
  });
  if (!user) return null;

  let notification;
  try {
    notification = await prisma.inboxNotification.create({
      data: {
        userId,
        kind: payload.kind,
        title: payload.title,
        body: payload.body,
        href: payload.href || null,
        dedupeKey: payload.dedupeKey,
      },
    });
  } catch (e) {
    if (e?.code === 'P2002') {
      return null;
    }
    throw e;
  }

  if (prefs.channelEmail) {
    await recordDelivery(notification.id, 'EMAIL', await deliverEmail(user, payload));
  }
  if (prefs.channelTelegram) {
    await recordDelivery(notification.id, 'TELEGRAM', await deliverTelegram(user, payload));
  }
  if (prefs.channelSms) {
    await recordDelivery(notification.id, 'SMS', await deliverSms(user, payload));
  }

  return notification;
}

export async function notifyClientSafe(userId, payload) {
  try {
    return await notifyClient(userId, payload);
  } catch (err) {
    logger.warn({ err, userId, kind: payload?.kind }, 'client notification failed');
    return null;
  }
}

function bookingHref(id) {
  return `/dashboard/client/bookings/${id}`;
}

export async function notifyBookingCreated(booking) {
  if (!booking?.clientId) {
    if (booking?.guestEmail) {
      const when = formatWhenMsk(booking.preferredAt);
      await notifyGuestEmail({
        to: booking.guestEmail,
        title: 'Заявка на запись принята',
        body: `Мы получили заявку на визит ${when}. Менеджер подтвердит время.`,
      });
    }
    return;
  }
  const when = formatWhenMsk(booking.preferredAt);
  await notifyClientSafe(booking.clientId, {
    kind: 'BOOKING_CREATED',
    title: 'Запись отправлена',
    body: `Заявка на визит ${when} принята. Менеджер подтвердит время.`,
    href: bookingHref(booking.id),
    dedupeKey: `booking-created:${booking.id}`,
  });
}

export async function notifyBookingConfirmed(booking) {
  if (!booking?.clientId) return;
  const when = formatWhenMsk(booking.preferredAt);
  await notifyClientSafe(booking.clientId, {
    kind: 'BOOKING_CONFIRMED',
    title: 'Запись подтверждена',
    body: `Ждём вас ${when}.`,
    href: bookingHref(booking.id),
    dedupeKey: `booking-confirmed:${booking.id}`,
  });
}

export async function notifyBookingCancelled(booking) {
  if (!booking?.clientId) return;
  const when = formatWhenMsk(booking.preferredAt);
  await notifyClientSafe(booking.clientId, {
    kind: 'BOOKING_CANCELLED',
    title: 'Запись отменена',
    body: `Визит ${when} отменён.`,
    href: bookingHref(booking.id),
    dedupeKey: `booking-cancelled:${booking.id}`,
  });
}

export async function notifyBookingRescheduled(booking) {
  if (!booking?.clientId) return;
  const when = formatWhenMsk(booking.preferredAt);
  await notifyClientSafe(booking.clientId, {
    kind: 'BOOKING_RESCHEDULED',
    title: 'Запись перенесена',
    body: `Новое время визита: ${when}.`,
    href: bookingHref(booking.id),
    dedupeKey: `booking-rescheduled:${booking.id}:${booking.preferredAt instanceof Date ? booking.preferredAt.toISOString() : booking.preferredAt}`,
  });
}

export async function notifyManagerMessage({ clientId, requestId, messageId, preview }) {
  if (!clientId) return;
  const text = String(preview || '').trim() || 'Менеджер ответил по вашей заявке';
  await notifyClientSafe(clientId, {
    kind: 'MANAGER_MESSAGE',
    title: 'Сообщение от менеджера',
    body: text.slice(0, 240),
    href: `/dashboard/client/cases/${requestId}?tab=messages`,
    dedupeKey: `manager-message:${messageId}`,
  });
}

export async function notifyGuestEmail({ to, title, body }) {
  const email = String(to || '').trim();
  if (!email) return;
  const env = getEnv();
  if (env.NODE_ENV !== 'test' && !isSmtpConfigured()) return;
  try {
    await sendNotificationEmail({ to: email, title, body, href: null, userName: null });
  } catch (err) {
    logger.warn({ err, to: email }, 'guest notification email failed');
  }
}
