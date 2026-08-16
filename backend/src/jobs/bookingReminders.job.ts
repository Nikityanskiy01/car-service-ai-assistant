import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { formatWhenMsk, notifyClientSafe } from '../modules/notifications/clientNotify.service.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
let timer = null;

function bookingHref(id) {
  return `/dashboard/client/bookings/${id}`;
}

export async function runBookingReminderCheck(now = new Date()) {
  const t = now.getTime();
  const dayFrom = new Date(t + 23 * HOUR_MS);
  const dayTo = new Date(t + 25 * HOUR_MS);
  const hourFrom = new Date(t + 50 * 60 * 1000);
  const hourTo = new Date(t + 70 * 60 * 1000);

  const dayBookings = await prisma.serviceBooking.findMany({
    where: {
      clientId: { not: null },
      status: { in: ['PENDING', 'CONFIRMED'] },
      preferredAt: { gte: dayFrom, lte: dayTo },
    },
    select: { id: true, clientId: true, preferredAt: true },
    take: 200,
  });

  const hourBookings = await prisma.serviceBooking.findMany({
    where: {
      clientId: { not: null },
      status: { in: ['PENDING', 'CONFIRMED'] },
      preferredAt: { gte: hourFrom, lte: hourTo },
    },
    select: { id: true, clientId: true, preferredAt: true },
    take: 200,
  });

  let sent = 0;
  for (const booking of dayBookings) {
    const when = formatWhenMsk(booking.preferredAt);
    const out = await notifyClientSafe(booking.clientId, {
      kind: 'BOOKING_REMINDER_DAY',
      title: 'Завтра запись в сервис',
      body: `Напоминаем: визит ${when}. Если планы изменились — перенесите или отмените запись.`,
      href: bookingHref(booking.id),
      dedupeKey: `booking-reminder-day:${booking.id}:${booking.preferredAt.toISOString().slice(0, 10)}`,
    });
    if (out) sent += 1;
  }

  for (const booking of hourBookings) {
    const when = formatWhenMsk(booking.preferredAt);
    const out = await notifyClientSafe(booking.clientId, {
      kind: 'BOOKING_REMINDER_HOUR',
      title: 'Через час запись в сервис',
      body: `Визит в ${when}. Если вы уже в пути — мы вас ждём.`,
      href: bookingHref(booking.id),
      dedupeKey: `booking-reminder-hour:${booking.id}`,
    });
    if (out) sent += 1;
  }

  if (sent > 0) logger.info({ sent }, 'booking reminders sent');
  return sent;
}

export function startBookingReminderJob() {
  if (timer) return;
  void runBookingReminderCheck().catch((err) => logger.warn({ err }, 'booking reminder tick failed'));
  timer = setInterval(() => {
    void runBookingReminderCheck().catch((err) => logger.warn({ err }, 'booking reminder tick failed'));
  }, CHECK_INTERVAL_MS);
}

export function stopBookingReminderJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export { DAY_MS, HOUR_MS };
