import { getEnv } from '../../config/env.js';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

/** @type {{ to: string; text: string } | null} */
let lastTestSms = null;

export function getLastTestSms() {
  return lastTestSms;
}

export function clearLastTestSms() {
  lastTestSms = null;
}

export function extractOtpFromSms(payload) {
  const source = String(payload?.text || '');
  const match = source.match(/\b(\d{6})\b/);
  return match?.[1] ?? null;
}

/**
 * SMS-провайдер ещё не подключён. Когда появится — добавить адаптер по SMS_PROVIDER.
 * Сейчас считаем канал настроенным только если заданы и провайдер, и ключ,
 * но отправка всё равно вернёт SMS_NOT_CONFIGURED, пока нет реализации.
 */
export function isSmsConfigured() {
  const env = getEnv();
  const provider = String(env.SMS_PROVIDER || '').trim().toLowerCase();
  const key = String(env.SMS_API_KEY || '').trim();
  if (!provider || ['none', 'off', 'stub', 'disabled'].includes(provider)) return false;
  return Boolean(key);
}

/**
 * @param {{ to: string; text: string }} payload
 */
export async function sendSms(payload) {
  const env = getEnv();
  const to = String(payload?.to || '').replace(/\D/g, '');
  const text = String(payload?.text || '').trim();

  if (env.NODE_ENV === 'test') {
    lastTestSms = { to, text };
    return;
  }

  if (!isSmsConfigured()) {
    logger.info({ to }, 'SMS skipped: provider not configured');
    throw new AppError(
      503,
      'SMS-провайдер ещё не подключён. Подтвердите телефон кодом с почты или войдите через Telegram.',
      'SMS_NOT_CONFIGURED',
    );
  }

  logger.warn({ to, provider: env.SMS_PROVIDER }, 'SMS adapter is not implemented yet');
  throw new AppError(
    503,
    'SMS-провайдер ещё не подключён. Подтвердите телефон кодом с почты или войдите через Telegram.',
    'SMS_NOT_CONFIGURED',
  );
}

/** SMS-адаптер ещё не реализован — канал в настройках есть, отправка пропускается. */
export function isSmsDeliveryReady() {
  return false;
}

/**
 * Тихая отправка для уведомлений: не бросает наружу.
 * @param {{ to: string; text: string }} payload
 * @returns {Promise<{ status: 'SENT' | 'SKIPPED' | 'FAILED'; error?: string }>}
 */
export async function trySendNotificationSms(payload) {
  if (!isSmsDeliveryReady()) {
    return { status: 'SKIPPED', error: 'SMS_NOT_CONFIGURED' };
  }
  try {
    await sendSms(payload);
    return { status: 'SENT' };
  } catch (e) {
    const code = e?.code || '';
    if (code === 'SMS_NOT_CONFIGURED') {
      return { status: 'SKIPPED', error: 'SMS_NOT_CONFIGURED' };
    }
    return { status: 'FAILED', error: String(e.message || e).slice(0, 2000) };
  }
}
