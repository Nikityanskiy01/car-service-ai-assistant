import nodemailer from 'nodemailer';
import { getEnv } from '../../config/env.js';
import { escapeHtml } from '../htmlEscape.js';
import { logger } from '../logger.js';

/** @type */
let lastTestOutbound = null;

export function getLastTestEmail() {
  return lastTestOutbound;
}

export function clearLastTestEmail() {
  lastTestOutbound = null;
}

/** @param mail */
export function extractVerificationCodeFromEmail(mail) {
  const source = `${mail?.text || ''}\n${mail?.html || ''}`;
  const match =
    source.match(/(?:код|code)[^\d]{0,40}(\d{6})/i) ?? source.match(/>(\d{6})</) ?? source.match(/\b(\d{6})\b/);
  return match?.[1] ?? null;
}

export function isSmtpConfigured() {
  const env = getEnv();
  return Boolean(String(env.SMTP_HOST || '').trim());
}

function createTransport() {
  const env = getEnv();
  const host = String(env.SMTP_HOST || '').trim().toLowerCase();
  const local = !host || host === 'mailpit' || host === 'localhost' || host === '127.0.0.1';
  const options: any = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: env.NODE_ENV === 'production' && !local && !env.SMTP_SECURE,
  };
  if (env.SMTP_USER) {
    options.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS || '' };
  }
  return nodemailer.createTransport(options);
}

/**
 * @param payload
 */
export async function sendMail(payload) {
  const env = getEnv();

  if (env.NODE_ENV === 'test') {
    lastTestOutbound = payload;
    return;
  }

  if (!isSmtpConfigured()) {
    logger.warn({ to: payload.to, subject: payload.subject }, 'SMTP not configured, email skipped');
    return;
  }

  const transport = createTransport();
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

/**
 * @param params
 */
export async function sendPasswordResetEmail({ to, resetUrl, userName, ttlMinutes }: any) {
  const subject = 'Сброс пароля — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
  const greetingHtml = userName ? `Здравствуйте, ${escapeHtml(userName)}!` : 'Здравствуйте!';
  const text = [
    greeting,
    '',
    'Вы запросили сброс пароля для личного кабинета.',
    `Перейдите по ссылке (действует ${ttlMinutes} мин.):`,
    resetUrl,
    '',
    'Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
  ].join('\n');

  const html = `
    <p>${greetingHtml}</p>
    <p>Вы запросили сброс пароля для личного кабинета.</p>
    <p><a href="${escapeHtml(resetUrl)}">Сбросить пароль</a></p>
    <p>Ссылка действует ${ttlMinutes} мин.</p>
    <p style="color:#666;font-size:14px">Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}

/**
 * @param params
 */
export async function sendEmailVerificationEmail({ to, code, userName, ttlMinutes, verifyUrl }: any) {
  const subject = 'Подтверждение email — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
  const greetingHtml = userName ? `Здравствуйте, ${escapeHtml(userName)}!` : 'Здравствуйте!';
  const text = [
    greeting,
    '',
    'Для завершения регистрации введите код подтверждения:',
    code,
    '',
    `Код действует ${ttlMinutes} мин.`,
    `Или перейдите: ${verifyUrl}`,
    '',
    'Если вы не регистрировались, проигнорируйте это письмо.',
  ].join('\n');

  const html = `
    <p>${greetingHtml}</p>
    <p>Для завершения регистрации введите код подтверждения:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em">${code}</p>
    <p>Код действует ${ttlMinutes} мин.</p>
    <p><a href="${escapeHtml(verifyUrl)}">Подтвердить email</a></p>
    <p style="color:#666;font-size:14px">Если вы не регистрировались, проигнорируйте это письмо.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}

/**
 * @param params
 */
export async function sendLoginOtpEmail({ to, code, userName, ttlMinutes }: any) {
  const subject = 'Код для входа — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
  const greetingHtml = userName ? `Здравствуйте, ${escapeHtml(userName)}!` : 'Здравствуйте!';
  const text = [
    greeting,
    '',
    'Код для входа в личный кабинет:',
    code,
    '',
    `Код действует ${ttlMinutes} мин.`,
    '',
    'Если вы не запрашивали вход, проигнорируйте это письмо.',
  ].join('\n');

  const html = `
    <p>${greetingHtml}</p>
    <p>Код для входа в личный кабинет:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em">${code}</p>
    <p>Код действует ${ttlMinutes} мин.</p>
    <p style="color:#666;font-size:14px">Если вы не запрашивали вход, проигнорируйте это письмо.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}

/**
 * @param params
 */
export async function sendPhoneVerifyEmail({ to, code, userName, phoneHint, ttlMinutes }: any) {
  const subject = 'Подтверждение телефона — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
  const greetingHtml = userName ? `Здравствуйте, ${escapeHtml(userName)}!` : 'Здравствуйте!';
  const text = [
    greeting,
    '',
    `Подтвердите номер ${phoneHint} кодом:`,
    code,
    '',
    `Код действует ${ttlMinutes} мин.`,
    '',
    'Если вы не запрашивали подтверждение, проигнорируйте это письмо.',
  ].join('\n');

  const html = `
    <p>${greetingHtml}</p>
    <p>Подтвердите номер <strong>${escapeHtml(phoneHint)}</strong> кодом:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em">${code}</p>
    <p>Код действует ${ttlMinutes} мин.</p>
    <p style="color:#666;font-size:14px">Если вы не запрашивали подтверждение, проигнорируйте это письмо.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}

/**
 * @param params
 */
export async function sendSessionRevokeEmail({ to, code, userName, ttlMinutes, targetLabel }: any) {
  const subject = 'Код для завершения сессий — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
  const greetingHtml = userName ? `Здравствуйте, ${escapeHtml(userName)}!` : 'Здравствуйте!';
  const text = [
    greeting,
    '',
    `Подтвердите завершение сессий (${targetLabel}) кодом:`,
    code,
    '',
    `Код действует ${ttlMinutes} мин.`,
    '',
    'Если вы этого не запрашивали — смените пароль: кто-то мог получить доступ к аккаунту.',
  ].join('\n');

  const html = `
    <p>${greetingHtml}</p>
    <p>Подтвердите завершение сессий (<strong>${escapeHtml(targetLabel)}</strong>) кодом:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em">${code}</p>
    <p>Код действует ${ttlMinutes} мин.</p>
    <p style="color:#666;font-size:14px">Если вы этого не запрашивали — смените пароль: кто-то мог получить доступ к аккаунту.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}

/**
 * @param params
 */
export async function sendNotificationEmail({ to, title, body, href, userName }: any) {
  const env = getEnv();
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
  const greetingHtml = userName ? `Здравствуйте, ${escapeHtml(userName)}!` : 'Здравствуйте!';
  const link = href ? `${String(env.APP_PUBLIC_URL || '').replace(/\/$/, '')}${href}` : null;
  const subject = `${title} — Автоассистент`;
  const text = [greeting, '', body, link ? `\nОткрыть: ${link}` : '', '', 'Это письмо отправлено, потому что уведомления включены в профиле.']
    .filter(Boolean)
    .join('\n');
  const html = `
    <p>${greetingHtml}</p>
    <p>${body.replace(/\n/g, '<br/>')}</p>
    ${link ? `<p><a href="${link}">Открыть в кабинете</a></p>` : ''}
    <p style="color:#666;font-size:14px">Это письмо отправлено, потому что уведомления включены в профиле.</p>
  `.trim();
  await sendMail({ to, subject, text, html });
}
