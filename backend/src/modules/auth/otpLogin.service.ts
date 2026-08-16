import type { User } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { AppError, isAppError } from '../../lib/errors.js';
import { getEnv } from '../../config/env.js';
import { isSmtpConfigured, sendLoginOtpEmail } from '../../lib/mail/mail.service.js';
import { isSmsConfigured, sendSms } from '../../lib/sms/sms.service.js';
import {
  assertOtpCooldown,
  consumeOtpChallenge,
  createOtpChallenge,
  dummyOtpToken,
  generateNumericOtp,
  maskEmail,
  maskPhone,
} from '../../lib/otp/otpChallenge.js';
import { normalizeAuthEmail } from '../../lib/authSecurity.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { assertNotLocked } from '../../lib/accountLockout.js';
import { completeVerifiedLogin } from './auth.service.js';
import * as securityService from '../users/security.service.js';
import {
  getTelegramBotInfo,
  isTelegramConfigured,
  sendTelegramMessage,
} from '../notifications/telegramAuth.bot.js';
import type {
  LoginResult,
  OtpChannel,
  OtpStartPayload,
  SessionMeta,
  StartLoginOtpInput,
  VerifyLoginOtpInput,
} from './auth.types.js';

function genericStartPayload(channel: OtpChannel, destinationHint = ''): OtpStartPayload {
  const env = getEnv();
  return {
    challengeToken: dummyOtpToken(),
    channel,
    destinationHint:
      destinationHint ||
      (channel === 'email' ? '•••@•••' : channel === 'sms' ? '+7 •••' : 'Telegram'),
    expiresInSec: env.OTP_CODE_TTL_MINUTES * 60,
    resendAfterSec: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function getLoginOptions() {
  const bot = await getTelegramBotInfo();
  return {
    password: true,
    emailOtp: true,
    sms: { configured: isSmsConfigured() },
    telegram: { configured: isTelegramConfigured() || getEnv().NODE_ENV === 'test', botUsername: bot.username },
  };
}

export async function startLoginOtp({ channel, email, phone }: StartLoginOtpInput): Promise<OtpStartPayload> {
  const env = getEnv();
  if (!['email', 'sms', 'telegram'].includes(channel)) {
    throw new AppError(400, 'Неизвестный канал подтверждения', 'BAD_REQUEST');
  }

  if (channel === 'email' && !isSmtpConfigured() && env.NODE_ENV !== 'test') {
    throw new AppError(503, 'Сервис отправки писем временно недоступен', 'SERVICE_UNAVAILABLE');
  }
  if (channel === 'sms' && env.NODE_ENV !== 'test' && !isSmsConfigured()) {
    throw new AppError(
      503,
      'SMS-провайдер ещё не подключён. Войдите паролем, кодом на почту или через Telegram.',
      'SMS_NOT_CONFIGURED',
    );
  }
  if (channel === 'telegram' && env.NODE_ENV !== 'test' && !isTelegramConfigured()) {
    throw new AppError(503, 'Telegram-бот ещё не настроен', 'TELEGRAM_NOT_CONFIGURED');
  }

  let user: User | null = null;
  let destination = '';
  let destinationHint = genericStartPayload(channel).destinationHint;
  let methodEnabled = false;

  if (channel === 'email') {
    const normalized = normalizeAuthEmail(email);
    if (!normalized) throw new AppError(400, 'Укажите email', 'BAD_REQUEST');
    user = await prisma.user.findUnique({ where: { email: normalized } });
    destination = normalized;
    destinationHint = maskEmail(normalized);
    methodEnabled = Boolean(user?.loginEmailOtpEnabled);
  } else {
    const digits = normalizePhone(phone);
    if (!isValidPhoneDigits(digits)) {
      throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
    }
    user = await prisma.user.findFirst({
      where: { phone: digits, phoneVerifiedAt: { not: null } },
    });
    destination = digits;
    destinationHint = maskPhone(digits);
    if (channel === 'sms') methodEnabled = Boolean(user?.loginSmsEnabled);
    if (channel === 'telegram') {
      methodEnabled = Boolean(user?.loginTelegramEnabled && user?.telegramChatId);
      destinationHint = 'Telegram';
    }
  }

  if (!user || user.blocked || !methodEnabled) {
    return genericStartPayload(channel, destinationHint);
  }

  try {
    await assertOtpCooldown(user.id, 'login', channel);
  } catch {
    return genericStartPayload(channel, destinationHint);
  }

  const code = generateNumericOtp();
  const challenge = await createOtpChallenge({
    userId: user.id,
    purpose: 'login',
    channel,
    destination: channel === 'telegram' ? String(user.telegramChatId) : destination,
    code,
  });

  try {
    if (channel === 'email') {
      await sendLoginOtpEmail({
        to: user.email,
        code,
        userName: user.fullName,
        ttlMinutes: env.OTP_CODE_TTL_MINUTES,
      });
    } else if (channel === 'sms') {
      await sendSms({
        to: destination,
        text: `Код для входа в автосервис: ${code}. Действует ${env.OTP_CODE_TTL_MINUTES} мин.`,
      });
    } else {
      await sendTelegramMessage(
        user.telegramChatId,
        `Код для входа в кабинет: ${code}\nДействует ${env.OTP_CODE_TTL_MINUTES} мин. Если это не вы — проигнорируйте сообщение.`,
      );
    }
  } catch (err) {
    await prisma.authOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw err;
  }

  return {
    challengeToken: challenge.token,
    channel,
    destinationHint,
    expiresInSec: env.OTP_CODE_TTL_MINUTES * 60,
    resendAfterSec: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export async function verifyLoginOtp(
  { challengeToken, code }: VerifyLoginOtpInput,
  meta: SessionMeta = {},
): Promise<LoginResult> {
  const challenge = await consumeOtpChallenge(challengeToken, code, { purpose: 'login' });

  if (!challenge.userId) {
    throw new AppError(400, 'Неверный или просроченный код', 'BAD_REQUEST');
  }

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || user.blocked) {
    throw new AppError(400, 'Неверный или просроченный код', 'BAD_REQUEST');
  }
  await assertNotLocked(user);

  const method = challenge.channel === 'email' ? 'email_otp' : challenge.channel === 'sms' ? 'sms' : 'telegram';
  try {
    return await completeVerifiedLogin(user, method, meta);
  } catch (err) {
    await securityService.recordLoginEvent({
      userId: user.id,
      success: false,
      method,
      reason: isAppError(err) ? err.code || 'login_failed' : 'login_failed',
      ...meta,
    });
    throw err;
  }
}
