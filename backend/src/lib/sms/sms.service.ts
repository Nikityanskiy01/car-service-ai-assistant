import { getEnv } from '../../config/env.js';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { assertSafeOutboundUrl, fetchSafeOutbound } from '../safeOutboundUrl.js';

/** @type */
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

function providerName() {
  return String(getEnv().SMS_PROVIDER || '').trim().toLowerCase();
}

export function isSmsConfigured() {
  const env = getEnv();
  const provider = providerName();
  if (!provider || ['none', 'off', 'stub', 'disabled'].includes(provider)) return false;
  if (provider === 'log') return env.NODE_ENV !== 'production';
  return Boolean(String(env.SMS_API_KEY || '').trim());
}

export function isSmsDeliveryReady() {
  return isSmsConfigured();
}

async function deliverViaSmsRu(to, text) {
  const env = getEnv();
  const endpoint = String(env.SMS_API_URL || 'https://sms.ru/sms/send').trim();
  assertSafeOutboundUrl(endpoint, { allowHttp: false });
  const url = new URL(endpoint);
  url.searchParams.set('api_id', String(env.SMS_API_KEY));
  url.searchParams.set('to', to);
  url.searchParams.set('msg', text);
  url.searchParams.set('json', '1');
  if (env.SMS_FROM) url.searchParams.set('from', env.SMS_FROM);
  const res = await fetchSafeOutbound(url.toString(), { method: 'GET', signal: AbortSignal.timeout(15_000) }, { allowHttp: false });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || Number(body.status_code) !== 100) {
    throw new Error(`sms.ru status ${body.status_code || res.status}`);
  }
}

async function deliverViaHttp(to, text) {
  const env = getEnv();
  const endpoint = String(env.SMS_API_URL || '').trim();
  if (!endpoint) {
    throw new AppError(503, 'Для SMS_PROVIDER=http задайте SMS_API_URL', 'SMS_NOT_CONFIGURED');
  }
  assertSafeOutboundUrl(endpoint, { allowHttp: false });
  const res = await fetchSafeOutbound(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SMS_API_KEY}`,
      },
      body: JSON.stringify({ to, text, from: env.SMS_FROM || undefined }),
      signal: AbortSignal.timeout(15_000),
    },
    { allowHttp: false },
  );
  if (!res.ok) {
    throw new Error(`SMS HTTP ${res.status}`);
  }
}

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

  const provider = providerName();
  if (provider === 'log') {
    logger.info({ to, text: text.slice(0, 160) }, 'SMS log provider');
    return;
  }

  try {
    if (provider === 'smsru' || provider === 'sms.ru') {
      await deliverViaSmsRu(to, text);
      return;
    }
    if (provider === 'http' || provider === 'generic') {
      await deliverViaHttp(to, text);
      return;
    }
    throw new AppError(
      503,
      `Неизвестный SMS_PROVIDER=${provider}. Поддерживаются smsru, http и log.`,
      'SMS_NOT_CONFIGURED',
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn({ to, provider, err: err instanceof Error ? err.message : String(err) }, 'SMS send failed');
    throw new AppError(502, 'Не удалось отправить SMS. Попробуйте позже.', 'SMS_SEND_FAILED');
  }
}

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
