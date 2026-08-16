import { Telegraf } from 'telegraf';
import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { SLA_MINUTES, formatWaitSinceCreated } from '../../lib/requestSla.js';

/**
 * @param sr
 */
export async function notifyNewServiceRequest(sr) {
  const name = sr.client?.fullName || sr.guestName || '—';
  const phone = sr.client?.phone || sr.guestPhone || '—';
  const payload = {
    type: 'NEW_SERVICE_REQUEST',
    serviceRequestId: sr.id,
    clientName: name,
    phone,
    make: sr.snapshotMake,
    model: sr.snapshotModel,
  };
  const payloadStr = JSON.stringify(payload);

  const env = getEnv();
  const notif = await prisma.notification.create({
    data: {
      serviceRequestId: sr.id,
      payload: payloadStr,
      status: 'PENDING',
    },
  });

  if (!env.TELEGRAM_BOT_TOKEN) {
    await prisma.notification.update({
      where: { id: notif.id },
      data: { status: 'SENT', attempts: 1 },
    });
    return;
  }

  const chatIds = (env.TELEGRAM_MANAGER_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    await prisma.notification.update({
      where: { id: notif.id },
      data: { status: 'FAILED', attempts: 1, lastError: 'No TELEGRAM_MANAGER_CHAT_IDS' },
    });
    return;
  }

  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
  const text = [
    '📋 Новая заявка',
    `ID: ${sr.id}`,
    `Клиент: ${name}`,
    `Тел.: ${phone}`,
    `Авто: ${sr.snapshotMake || '—'} ${sr.snapshotModel || '—'}`,
  ].join('\n');

  try {
    for (const chatId of chatIds) {
      await bot.telegram.sendMessage(chatId, text);
    }
    await prisma.notification.update({
      where: { id: notif.id },
      data: { status: 'SENT', attempts: 1 },
    });
  } catch (e) {
    logger.warn({ err: e }, 'telegram send failed');
    await prisma.notification.update({
      where: { id: notif.id },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: String(e.message || e).slice(0, 2000),
      },
    });
  }
}

/**
 * @param sr
 */
export async function notifySlaBreached(sr) {
  const name = sr.client?.fullName || sr.guestName || '—';
  const phone = sr.client?.phone || sr.guestPhone || '—';
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(sr.createdAt).getTime()) / 60000));
  const payload = {
    type: 'SLA_BREACH',
    serviceRequestId: sr.id,
    clientName: name,
    phone,
    minutesWithoutResponse: minutes,
    hoursWithoutResponse: minutes / 60,
  };
  const payloadStr = JSON.stringify(payload);

  const env = getEnv();
  const notif = await prisma.notification.create({
    data: {
      serviceRequestId: sr.id,
      payload: payloadStr,
      status: 'PENDING',
    },
  });

  if (!env.TELEGRAM_BOT_TOKEN) {
    await prisma.notification.update({
      where: { id: notif.id },
      data: { status: 'SENT', attempts: 1 },
    });
    return;
  }

  const chatIds = (env.TELEGRAM_MANAGER_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    await prisma.notification.update({
      where: { id: notif.id },
      data: { status: 'FAILED', attempts: 1, lastError: 'No TELEGRAM_MANAGER_CHAT_IDS' },
    });
    return;
  }

  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
  const text = [
    `⚠️ Без ответа больше ${SLA_MINUTES} мин`,
    `Заявка: ${sr.id.slice(0, 8)}`,
    `Клиент: ${name}`,
    `Тел.: ${phone}`,
    `Без ответа: ${formatWaitSinceCreated(sr)}`,
    `Авто: ${sr.snapshotMake || '—'} ${sr.snapshotModel || '—'}`,
  ].join('\n');

  try {
    for (const chatId of chatIds) {
      await bot.telegram.sendMessage(chatId, text);
    }
    await prisma.notification.update({
      where: { id: notif.id },
      data: { status: 'SENT', attempts: 1 },
    });
  } catch (e) {
    logger.warn({ err: e }, 'telegram SLA escalation failed');
    await prisma.notification.update({
      where: { id: notif.id },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: String(e.message || e).slice(0, 2000),
      },
    });
  }
}
