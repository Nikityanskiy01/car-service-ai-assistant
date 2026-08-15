import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isTelegramConfigured } from './telegramAuth.bot.js';
import { isSmsDeliveryReady } from '../../lib/sms/sms.service.js';
import { getOrCreatePrefs, updatePrefs } from './clientNotify.service.js';

function serializeItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listInbox(userId, { limit = 30 } = {}) {
  const take = Math.min(50, Math.max(1, Number(limit) || 30));
  const [items, unreadCount] = await Promise.all([
    prisma.inboxNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.inboxNotification.count({ where: { userId, readAt: null } }),
  ]);
  return { items: items.map(serializeItem), unreadCount };
}

export async function unreadCount(userId) {
  return prisma.inboxNotification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId, ids) {
  const where = { userId, readAt: null };
  if (Array.isArray(ids) && ids.length) {
    where.id = { in: ids.slice(0, 100) };
  }
  const result = await prisma.inboxNotification.updateMany({
    where,
    data: { readAt: new Date() },
  });
  return { updated: result.count, unreadCount: await unreadCount(userId) };
}

export async function getPreferences(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailProfile: true,
      phone: true,
      phoneVerifiedAt: true,
      telegramChatId: true,
      telegram: true,
    },
  });
  if (!user) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const prefs = await getOrCreatePrefs(userId);
  const email = user.emailProfile || user.email;
  return {
    ...prefs,
    channels: {
      inApp: { enabled: true, available: true, label: 'На сайте' },
      email: {
        enabled: prefs.channelEmail,
        available: Boolean(email),
        destination: email || null,
      },
      telegram: {
        enabled: prefs.channelTelegram,
        available: Boolean(user.telegramChatId),
        linked: Boolean(user.telegramChatId),
        botConfigured: isTelegramConfigured(),
        destination: user.telegram ? `@${String(user.telegram).replace(/^@/, '')}` : null,
      },
      sms: {
        enabled: prefs.channelSms,
        available: isSmsDeliveryReady(),
        soon: true,
        hint: 'Сервис подключим позже',
        destination: user.phone || null,
      },
    },
  };
}

export async function patchPreferences(userId, patch) {
  await updatePrefs(userId, patch);
  return getPreferences(userId);
}
