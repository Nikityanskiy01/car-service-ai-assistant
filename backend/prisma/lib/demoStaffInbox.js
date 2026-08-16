import { DEMO_INBOX_DEDUPE_PREFIX, clearDemoInboxNotifications } from './demoInboxNotifications.js';

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000);
}

async function writeInbox(prisma, userId, samples, keyPrefix) {
  if (!userId) return 0;
  await prisma.userNotificationPreference.upsert({
    where: { userId },
    update: { bookingReminders: true, messageAlerts: true, marketing: false },
    create: {
      userId,
      bookingReminders: true,
      messageAlerts: true,
      marketing: false,
      channelEmail: true,
      channelTelegram: true,
      channelSms: false,
    },
  });

  for (const sample of samples) {
    await prisma.inboxNotification.create({
      data: {
        userId,
        kind: sample.kind,
        title: sample.title,
        body: sample.body,
        href: sample.href,
        dedupeKey: `${DEMO_INBOX_DEDUPE_PREFIX}${keyPrefix}${sample.key}`,
        createdAt: hoursAgo(sample.hoursAgo),
        readAt: sample.read ? hoursAgo(sample.readHoursAgo ?? sample.hoursAgo - 0.4) : null,
      },
    });
  }
  return samples.length;
}

/**
 * Очередь смены: заявки, SLA, записи, сообщения с сайта.
 */
export async function seedManagerInbox(prisma, { userId, requestId, bookingId }) {
  if (!userId) return 0;
  await clearDemoInboxNotifications(prisma, userId);

  const requestHref = requestId
    ? `/dashboard/manager/requests/${requestId}`
    : '/dashboard/manager/requests';
  const bookingHref = bookingId
    ? `/dashboard/manager/bookings?focus=${bookingId}`
    : '/dashboard/manager/bookings';

  return writeInbox(
    prisma,
    userId,
    [
      {
        key: 'sla',
        kind: 'MANAGER_MESSAGE',
        title: 'SLA: нет ответа больше 15 минут',
        body: 'Mercedes E-класс — перегрев. Клиент ждёт звонка, заявка без ответственного.',
        href: '/dashboard/manager/requests?status=NEW',
        hoursAgo: 0.4,
        read: false,
      },
      {
        key: 'new-req',
        kind: 'BOOKING_CREATED',
        title: 'Новая заявка в очереди',
        body: 'Ford Focus: стук ремня на холодную. Анна Соколова оставила заявку 20 минут назад.',
        href: requestHref,
        hoursAgo: 0.7,
        read: false,
      },
      {
        key: 'arrived',
        kind: 'BOOKING_CONFIRMED',
        title: 'Клиент на посту',
        body: 'Kia Rio — проверка подвески. Клиент уже на территории, пост 2.',
        href: bookingHref,
        hoursAgo: 1.5,
        read: false,
      },
      {
        key: 'site',
        kind: 'MANAGER_MESSAGE',
        title: 'Сообщение с сайта',
        body: 'Ольга Н. спрашивает про развал после замены рычагов. Статус: новое.',
        href: '/dashboard/manager/contacts',
        hoursAgo: 3,
        read: false,
      },
      {
        key: 'ai',
        kind: 'MANAGER_MESSAGE',
        title: 'Нужна оценка диагноза ИИ',
        body: 'Audi A6 в работе: рывки DSG. После осмотра отметьте, совпал ли предварительный разбор.',
        href: '/dashboard/manager/ai-quality',
        hoursAgo: 6,
        read: true,
        readHoursAgo: 5.5,
      },
      {
        key: 'noshow',
        kind: 'BOOKING_CANCELLED',
        title: 'Клиент не приехал',
        body: 'Вчерашний слот предпродажного осмотра — неявка. Слот можно отдать из календаря.',
        href: '/dashboard/manager/bookings',
        hoursAgo: 22,
        read: true,
        readHoursAgo: 20,
      },
      {
        key: 'done',
        kind: 'COMPLETION_DOCUMENTS',
        title: 'Готово к выдаче',
        body: 'Lexus RX: замена колодок и дисков. Заказ-наряд в карточке, клиент заберёт после 18:00.',
        href: '/dashboard/manager/requests?status=COMPLETED',
        hoursAgo: 28,
        read: true,
        readHoursAgo: 26,
      },
    ],
    'mgr:',
  );
}

/**
 * Пульт: интеграции, CMS, команда, очередь целиком.
 */
export async function seedAdminInbox(prisma, { userId }) {
  if (!userId) return 0;
  await clearDemoInboxNotifications(prisma, userId);

  return writeInbox(
    prisma,
    userId,
    [
      {
        key: 'crm-auth',
        kind: 'MANAGER_MESSAGE',
        title: 'amoCRM: токен истёк',
        body: 'Синхронизация лидов остановлена (AUTH_EXPIRED). Обновите OAuth в интеграциях.',
        href: '/dashboard/admin/integrations',
        hoursAgo: 0.5,
        read: false,
      },
      {
        key: 'jobs',
        kind: 'MANAGER_MESSAGE',
        title: 'Очередь обмена: ошибки',
        body: 'МойСклад недоступен, 3 задания в dead-letter. Bitrix24 синхронизируется штатно.',
        href: '/dashboard/admin/integrations/jobs',
        hoursAgo: 1.1,
        read: false,
      },
      {
        key: 'users',
        kind: 'MANAGER_MESSAGE',
        title: 'В базе новые клиенты',
        body: 'Появились карточки Анны, Сергея, Марии и Дмитрия. Один профиль заблокирован.',
        href: '/dashboard/admin/team/users',
        hoursAgo: 4,
        read: false,
      },
      {
        key: 'cms',
        kind: 'MARKETING',
        title: 'Черновик на сайте',
        body: 'Блок «Акция на тормоза» сохранён, но не опубликован. Проверьте CMS перед выходными.',
        href: '/dashboard/admin/content',
        hoursAgo: 8,
        read: true,
        readHoursAgo: 7,
      },
      {
        key: 'audit',
        kind: 'MANAGER_MESSAGE',
        title: 'Журнал действий',
        body: 'За сутки: смена роли не требовалась, CMS правил админ, статусы заявок — менеджер.',
        href: '/dashboard/admin/security/audit',
        hoursAgo: 12,
        read: true,
        readHoursAgo: 10,
      },
      {
        key: 'kpi',
        kind: 'MANAGER_MESSAGE',
        title: 'Воронка за 30 дней',
        body: 'Консультаций больше, чем заявок: часть сессий брошена. Откройте аналитику.',
        href: '/dashboard/admin/analytics',
        hoursAgo: 30,
        read: true,
        readHoursAgo: 28,
      },
    ],
    'adm:',
  );
}
