export const DEMO_INBOX_DEDUPE_PREFIX = 'demo:inbox:';

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000);
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600_000);
}

function formatWhenMsk(date) {
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

function bookingHref(id) {
  return `/dashboard/client/bookings/${id}`;
}

function caseHref(requestId) {
  return `/dashboard/client/cases/${requestId}?tab=messages`;
}

export async function clearDemoInboxNotifications(prisma, userId) {
  await prisma.inboxNotificationDelivery.deleteMany({
    where: { notification: { userId, dedupeKey: { startsWith: DEMO_INBOX_DEDUPE_PREFIX } } },
  });
  await prisma.inboxNotification.deleteMany({
    where: { userId, dedupeKey: { startsWith: DEMO_INBOX_DEDUPE_PREFIX } },
  });
}

/**
 * Демо-набор inbox-уведомлений для визуальной проверки UI.
 */
export async function seedDemoInboxNotifications(prisma, { userId, bookings = [], requests = [] }) {
  if (!userId) return 0;

  await clearDemoInboxNotifications(prisma, userId);

  await prisma.userNotificationPreference.upsert({
    where: { userId },
    update: { bookingReminders: true, messageAlerts: true, marketing: true },
    create: {
      userId,
      bookingReminders: true,
      messageAlerts: true,
      marketing: true,
    },
  });

  const confirmed =
    bookings.find((b) => b.status === 'CONFIRMED') ||
    bookings.find((b) => b.status === 'PENDING') ||
    bookings[0];
  const pending = bookings.find((b) => b.status === 'PENDING') || confirmed;
  const cancelled = bookings.find((b) => b.status === 'CANCELLED') || confirmed;
  const request =
    requests.find((r) => r.status === 'IN_PROGRESS') ||
    requests.find((r) => r.status === 'NEW') ||
    requests[0];

  const whenConfirmed = confirmed ? formatWhenMsk(confirmed.preferredAt) : 'завтра в 11:00';
  const whenPending = pending ? formatWhenMsk(pending.preferredAt) : 'после 12:00';
  const whenCancelled = cancelled ? formatWhenMsk(cancelled.preferredAt) : 'вчера в 15:00';
  const whenSoon = confirmed ? formatWhenMsk(confirmed.preferredAt) : formatWhenMsk(hoursFromNow(1));

  const samples = [
    {
      key: 'reminder-hour',
      kind: 'BOOKING_REMINDER_HOUR',
      title: 'Скоро визит',
      body: `Напоминание: визит через час — ${whenSoon}. Возьмите ключи и сервисную книжку.`,
      href: confirmed ? bookingHref(confirmed.id) : null,
      hoursAgo: 0.25,
      read: false,
    },
    {
      key: 'manager-today',
      kind: 'MANAGER_MESSAGE',
      title: 'Сообщение от менеджера',
      body: 'Приняли заявку в работу. Нужны фото/видео стука, если есть — так быстрее сориентируемся по подвеске.',
      href: request ? caseHref(request.id) : null,
      hoursAgo: 1.2,
      read: false,
    },
    {
      key: 'booking-confirmed',
      kind: 'BOOKING_CONFIRMED',
      title: 'Запись подтверждена',
      body: `Ждём вас ${whenConfirmed}. Вход с парковки.`,
      href: confirmed ? bookingHref(confirmed.id) : null,
      hoursAgo: 3,
      read: false,
    },
    {
      key: 'booking-created',
      kind: 'BOOKING_CREATED',
      title: 'Запись отправлена',
      body: `Заявка на визит ${whenPending} принята. Менеджер подтвердит время в течение дня.`,
      href: pending ? bookingHref(pending.id) : null,
      hoursAgo: 5,
      read: true,
      readHoursAgo: 4.5,
    },
    {
      key: 'reminder-day',
      kind: 'BOOKING_REMINDER_DAY',
      title: 'Напоминание о визите',
      body: `Завтра визит ${whenConfirmed}. Если планы изменились — перенесите в кабинете.`,
      href: confirmed ? bookingHref(confirmed.id) : null,
      hoursAgo: 26,
      read: false,
    },
    {
      key: 'manager-yesterday',
      kind: 'MANAGER_MESSAGE',
      title: 'Сообщение от менеджера',
      body: 'Запись подтверждена на субботу 11:00. Возьмите сервисную книжку.',
      href: request ? caseHref(request.id) : null,
      hoursAgo: 28,
      read: true,
      readHoursAgo: 27,
    },
    {
      key: 'booking-rescheduled',
      kind: 'BOOKING_RESCHEDULED',
      title: 'Запись перенесена',
      body: `Новое время визита: ${whenConfirmed}. Старый слот освобождён.`,
      href: confirmed ? bookingHref(confirmed.id) : null,
      hoursAgo: 30,
      read: false,
    },
    {
      key: 'booking-cancelled',
      kind: 'BOOKING_CANCELLED',
      title: 'Запись отменена',
      body: `Визит ${whenCancelled} отменён. Можно выбрать другой день в разделе «Записи».`,
      href: cancelled ? bookingHref(cancelled.id) : null,
      hoursAgo: 50,
      read: true,
      readHoursAgo: 49,
    },
    {
      key: 'marketing-season',
      kind: 'MARKETING',
      title: 'Сезонная проверка тормозов',
      body: 'До конца месяца — комплексная диагностика тормозов со скидкой 15%. Запись в один клик из кабинета.',
      href: '/dashboard/client/bookings',
      hoursAgo: 72,
      read: false,
    },
    {
      key: 'marketing-to',
      kind: 'MARKETING',
      title: 'Плановое ТО без ожидания',
      body: 'Открыли дополнительные слоты на регламентное ТО: масло, фильтры и свечи в день обращения.',
      href: '/services',
      hoursAgo: 120,
      read: true,
      readHoursAgo: 118,
    },
  ];

  for (const sample of samples) {
    await prisma.inboxNotification.create({
      data: {
        userId,
        kind: sample.kind,
        title: sample.title,
        body: sample.body,
        href: sample.href,
        dedupeKey: `${DEMO_INBOX_DEDUPE_PREFIX}${sample.key}`,
        createdAt: hoursAgo(sample.hoursAgo),
        readAt: sample.read ? hoursAgo(sample.readHoursAgo ?? sample.hoursAgo - 0.5) : null,
      },
    });
  }

  return samples.length;
}
