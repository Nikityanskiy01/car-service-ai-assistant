import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import {
  assertOtpCooldown,
  consumeOtpChallenge,
  createOtpChallenge,
  generateLinkCode,
  generateNumericOtp,
  maskEmail,
} from '../../lib/otp/otpChallenge.js';
import { isSmtpConfigured, sendPhoneVerifyEmail } from '../../lib/mail/mail.service.js';
import { getTelegramBotInfo, isTelegramConfigured } from '../notifications/telegramAuth.bot.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { assertSensitiveAction } from './security.service.js';

export async function startPhoneVerification(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (!user.emailVerifiedAt) {
    throw new AppError(400, 'Сначала подтвердите email — код придёт на почту', 'EMAIL_NOT_VERIFIED');
  }

  const digits = normalizePhone(user.phone);
  if (!isValidPhoneDigits(digits)) {
    throw new AppError(400, 'Укажите корректный номер телефона в профиле', 'BAD_REQUEST');
  }

  const taken = await prisma.user.findFirst({
    where: { phone: digits, phoneVerifiedAt: { not: null }, id: { not: userId } },
    select: { id: true },
  });
  if (taken) {
    throw new AppError(400, 'Этот номер уже подтверждён в другом аккаунте', 'PHONE_TAKEN');
  }

  if (user.phoneVerifiedAt && user.phone === digits) {
    return { alreadyVerified: true, phone: digits };
  }

  const env = getEnv();
  if (!isSmtpConfigured() && env.NODE_ENV !== 'test') {
    throw new AppError(503, 'Сервис отправки писем временно недоступен', 'SERVICE_UNAVAILABLE');
  }

  await assertOtpCooldown(userId, 'verify_phone', 'email');
  const code = generateNumericOtp();
  const challenge = await createOtpChallenge({
    userId,
    purpose: 'verify_phone',
    channel: 'email',
    destination: user.email,
    code,
  });

  await sendPhoneVerifyEmail({
    to: user.email,
    code,
    userName: user.fullName,
    phoneHint: maskPhoneLocal(digits),
    ttlMinutes: env.OTP_CODE_TTL_MINUTES,
  });

  return {
    alreadyVerified: false,
    challengeToken: challenge.token,
    destinationHint: maskEmail(user.email),
    expiresInSec: env.OTP_CODE_TTL_MINUTES * 60,
    resendAfterSec: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function confirmPhoneVerification(userId, { code }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const pending = await prisma.authOtpChallenge.findFirst({
    where: {
      userId,
      purpose: 'verify_phone',
      channel: 'email',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!pending) {
    throw new AppError(400, 'Неверный или просроченный код', 'BAD_REQUEST');
  }

  await consumeOtpChallenge(pending.token, code, { purpose: 'verify_phone' });

  const digits = normalizePhone(user.phone);
  const taken = await prisma.user.findFirst({
    where: { phone: digits, phoneVerifiedAt: { not: null }, id: { not: userId } },
    select: { id: true },
  });
  if (taken) {
    throw new AppError(400, 'Этот номер уже подтверждён в другом аккаунте', 'PHONE_TAKEN');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      phoneVerifiedAt: new Date(),
      loginSmsEnabled: true,
    },
  });
  invalidateAuthUserCache(userId);
  return { ok: true, phoneVerified: true };
}

export async function startTelegramLink(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (!user.phoneVerifiedAt) {
    throw new AppError(400, 'Сначала подтвердите телефон кодом с почты', 'PHONE_NOT_VERIFIED');
  }
  if (!isTelegramConfigured() && getEnv().NODE_ENV !== 'test') {
    throw new AppError(503, 'Подключение Telegram пока недоступно', 'TELEGRAM_NOT_CONFIGURED');
  }
  if (user.telegramChatId) {
    const bot = await getTelegramBotInfo();
    return {
      alreadyLinked: true,
      botUsername: bot.username,
    };
  }

  await assertOtpCooldown(userId, 'link_telegram', 'telegram');
  const code = generateLinkCode();
  const env = getEnv();
  await createOtpChallenge({
    userId,
    purpose: 'link_telegram',
    channel: 'telegram',
    destination: 'pending',
    code,
    token: code,
  });

  const bot = await getTelegramBotInfo();
  const username = bot.username;
  const deepLink = username ? `https://t.me/${username}?start=${code}` : null;
  return {
    alreadyLinked: false,
    code,
    botUsername: username,
    deepLink,
    expiresInSec: env.OTP_CODE_TTL_MINUTES * 60,
    resendAfterSec: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function completeTelegramLinkFromBot({ code, chatId, username }) {
  const token = String(code || '')
    .trim()
    .toUpperCase();
  if (!token) return { ok: false, reason: 'not_found' };

  const challenge = await prisma.authOtpChallenge.findFirst({
    where: {
      purpose: 'link_telegram',
      token,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!challenge?.userId) return { ok: false, reason: 'not_found' };

  const taken = await prisma.user.findFirst({
    where: { telegramChatId: String(chatId), id: { not: challenge.userId } },
    select: { id: true },
  });
  if (taken) return { ok: false, reason: 'taken' };

  const data = {
    telegramChatId: String(chatId),
    telegramLinkedAt: new Date(),
    loginTelegramEnabled: true,
  };
  if (username) data.telegram = String(username).replace(/^@/, '');

  await prisma.$transaction([
    prisma.user.update({ where: { id: challenge.userId }, data }),
    prisma.authOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date(), destination: String(chatId) },
    }),
  ]);
  invalidateAuthUserCache(challenge.userId);
  return { ok: true };
}

export async function unlinkTelegram(userId, verification) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  await assertSensitiveAction(user, verification);

  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkedAt: null,
      loginTelegramEnabled: false,
    },
  });
  await prisma.authOtpChallenge.deleteMany({
    where: { userId, purpose: 'link_telegram', consumedAt: null },
  });
  invalidateAuthUserCache(userId);
  return { ok: true };
}

export async function updateLoginMethods(userId, patch) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const disablesEnabledMethod =
    (patch.loginEmailOtpEnabled === false && user.loginEmailOtpEnabled) ||
    (patch.loginSmsEnabled === false && user.loginSmsEnabled) ||
    (patch.loginTelegramEnabled === false && user.loginTelegramEnabled);
  if (disablesEnabledMethod) {
    await assertSensitiveAction(user, patch);
  }

  const data = {};
  if (patch.loginEmailOtpEnabled != null) {
    data.loginEmailOtpEnabled = Boolean(patch.loginEmailOtpEnabled);
  }
  if (patch.loginSmsEnabled != null) {
    if (patch.loginSmsEnabled && !user.phoneVerifiedAt) {
      throw new AppError(400, 'Сначала подтвердите телефон', 'PHONE_NOT_VERIFIED');
    }
    data.loginSmsEnabled = Boolean(patch.loginSmsEnabled);
  }
  if (patch.loginTelegramEnabled != null) {
    if (patch.loginTelegramEnabled && !user.telegramChatId) {
      throw new AppError(400, 'Сначала подключите Telegram-бота', 'TELEGRAM_NOT_LINKED');
    }
    data.loginTelegramEnabled = Boolean(patch.loginTelegramEnabled);
  }

  await prisma.user.update({ where: { id: userId }, data });
  invalidateAuthUserCache(userId);
  return { ok: true };
}

function maskPhoneLocal(digits) {
  const d = String(digits || '');
  if (d.length === 11 && d.startsWith('7')) {
    return `+7 (•••) ••-••-${d.slice(-2)}`;
  }
  return `+${d.slice(0, 1)} ••• ${d.slice(-2)}`;
}
