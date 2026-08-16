import { getEnv } from '../../config/env.js';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  enrichClientMeta,
  loginMethodLabel,
  loginReasonLabel,
} from '../../lib/clientMeta.js';
import { isSmtpConfigured } from '../../lib/mail/mail.service.js';
import { isSmsConfigured } from '../../lib/sms/sms.service.js';
import { getTelegramBotInfo, isTelegramConfigured } from '../notifications/telegramAuth.bot.js';
import type { LoginEventInput } from '../auth/auth.types.js';

const MAX_LOGIN_EVENTS = 50;

export async function recordLoginEvent({
  userId,
  success,
  method = 'password',
  ip = null,
  userAgent = null,
  reason = null,
}: LoginEventInput) {
  if (!userId) return;
  try {
    await prisma.userLoginEvent.create({
      data: {
        userId,
        success: Boolean(success),
        method,
        ip: ip ? String(ip).slice(0, 64) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        reason: reason ? String(reason).slice(0, 120) : null,
      },
    });
    const old = await prisma.userLoginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_LOGIN_EVENTS,
      select: { id: true },
    });
    if (old.length) {
      await prisma.userLoginEvent.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
  } catch {
    // history must never break auth
  }
}

export async function getSecurityStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      telegram: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      telegramChatId: true,
      telegramLinkedAt: true,
      totpEnabledAt: true,
      totpBackupHashes: true,
      loginEmailOtpEnabled: true,
      loginSmsEnabled: true,
      loginTelegramEnabled: true,
    },
  });
  if (!user) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const bot = await getTelegramBotInfo();
  const env = getEnv();
  return {
    totpEnabled: Boolean(user.totpEnabledAt),
    totpEnabledAt: user.totpEnabledAt?.toISOString?.() ?? null,
    backupRemaining: Array.isArray(user.totpBackupHashes) ? user.totpBackupHashes.length : 0,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString?.() ?? null,
    telegram: user.telegram,
    telegramLinked: Boolean(user.telegramChatId),
    telegramLinkedAt: user.telegramLinkedAt?.toISOString?.() ?? null,
    telegramBotUsername: bot.username,
    loginMethods: {
      password: true,
      emailOtp: Boolean(user.loginEmailOtpEnabled),
      sms: Boolean(user.loginSmsEnabled),
      telegram: Boolean(user.loginTelegramEnabled),
    },
    channels: {
      emailConfigured: isSmtpConfigured() || env.NODE_ENV === 'test',
      smsConfigured: isSmsConfigured(),
      telegramConfigured: isTelegramConfigured() || env.NODE_ENV === 'test',
    },
  };
}

export async function listLoginHistory(userId: string, limit = 20) {
  const take = Math.min(50, Math.max(1, Number(limit) || 20));
  const rows = await prisma.userLoginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map((row) => {
    const meta = enrichClientMeta({ ip: row.ip, userAgent: row.userAgent });
    return {
      id: row.id,
      success: row.success,
      method: row.method,
      methodLabel: loginMethodLabel(row.method),
      ip: row.ip,
      ipLabel: meta.ipLabel,
      ipKind: meta.ipKind,
      userAgent: row.userAgent,
      device: meta.device,
      reason: row.reason,
      reasonLabel: loginReasonLabel(row.reason),
      createdAt: row.createdAt.toISOString(),
    };
  });
}
