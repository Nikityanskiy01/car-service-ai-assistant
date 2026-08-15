import { Telegraf } from 'telegraf';
import { getEnv } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

/** @type {{ chatId: string; text: string } | null} */
let lastTestTelegram = null;
/** @type {import('telegraf').Telegraf | null} */
let bot = null;
/** @type {{ username: string | null; configured: boolean } | null} */
let cachedInfo = null;

export function getLastTestTelegram() {
  return lastTestTelegram;
}

export function clearLastTestTelegram() {
  lastTestTelegram = null;
}

export function extractOtpFromTelegram(payload) {
  const source = String(payload?.text || '');
  const match = source.match(/\b(\d{6})\b/);
  return match?.[1] ?? null;
}

export function isTelegramConfigured() {
  return Boolean(String(getEnv().TELEGRAM_BOT_TOKEN || '').trim());
}

export async function getTelegramBotInfo() {
  if (cachedInfo) return cachedInfo;
  const env = getEnv();
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const override = String(env.TELEGRAM_BOT_USERNAME || '')
    .trim()
    .replace(/^@/, '');

  if (override) {
    cachedInfo = { username: override, configured: Boolean(token) };
    return cachedInfo;
  }
  if (!token) {
    cachedInfo = { username: null, configured: false };
    return cachedInfo;
  }
  if (env.NODE_ENV === 'test') {
    cachedInfo = { username: 'autoservice_auth_bot', configured: true };
    return cachedInfo;
  }

  try {
    const client = new Telegraf(token);
    const me = await client.telegram.getMe();
    cachedInfo = { username: me.username || null, configured: true };
    return cachedInfo;
  } catch (err) {
    logger.warn({ err }, 'telegram getMe failed');
    cachedInfo = { username: null, configured: true };
    return cachedInfo;
  }
}

export async function sendTelegramMessage(chatId, text) {
  const env = getEnv();
  if (env.NODE_ENV === 'test') {
    lastTestTelegram = { chatId: String(chatId), text: String(text) };
    return;
  }
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    throw new AppError(
      503,
      'Telegram-бот ещё не настроен. Обратитесь к администратору.',
      'TELEGRAM_NOT_CONFIGURED',
    );
  }
  const client = new Telegraf(token);
  await client.telegram.sendMessage(String(chatId), String(text));
}

function normalizeLinkCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function handleLinkCode(ctx, rawCode) {
  const code = normalizeLinkCode(rawCode);
  if (code.length < 6) {
    await ctx.reply(
      'Чтобы привязать кабинет, откройте настройки безопасности и нажмите «Подключить Telegram». Затем пришлите код оттуда или перейдите по ссылке.',
    );
    return;
  }

  const { completeTelegramLinkFromBot } = await import('../users/contactVerify.service.js');
  const result = await completeTelegramLinkFromBot({
    code,
    chatId: String(ctx.chat.id),
    username: ctx.from?.username || null,
  });

  if (result.ok) {
    await ctx.reply('Аккаунт подключён. Теперь можно входить в кабинет кодом из этого чата.');
    return;
  }
  if (result.reason === 'taken') {
    await ctx.reply('Этот Telegram уже привязан к другому аккаунту.');
    return;
  }
  await ctx.reply('Код не найден или устарел. Запросите новый в настройках безопасности кабинета.');
}

export async function startTelegramAuthBot() {
  const env = getEnv();
  if (env.NODE_ENV === 'test' || bot) return;
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return;

  const instance = new Telegraf(token);
  instance.start(async (ctx) => {
    await handleLinkCode(ctx, ctx.startPayload || '');
  });
  instance.on('text', async (ctx) => {
    const text = String(ctx.message?.text || '').trim();
    if (text.startsWith('/')) return;
    await handleLinkCode(ctx, text);
  });
  instance.catch((err) => {
    logger.warn({ err }, 'telegram auth bot error');
  });

  try {
    await instance.launch({ dropPendingUpdates: true });
    bot = instance;
    logger.info('telegram auth bot started');
  } catch (err) {
    logger.warn({ err }, 'telegram auth bot failed to start');
  }
}

export async function stopTelegramAuthBot() {
  if (!bot) return;
  try {
    bot.stop('shutdown');
  } catch (err) {
    logger.warn({ err }, 'telegram auth bot stop failed');
  }
  bot = null;
}
