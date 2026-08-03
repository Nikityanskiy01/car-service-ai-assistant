import nodemailer from 'nodemailer';
import { getEnv } from '../../config/env.js';
import { logger } from '../logger.js';

/** @type {{ to: string; subject: string; text: string; html: string } | null} */
let lastTestOutbound = null;

export function getLastTestEmail() {
  return lastTestOutbound;
}

export function clearLastTestEmail() {
  lastTestOutbound = null;
}

/** @param {{ text?: string; html?: string } | null} mail */
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
  const options = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
  };
  if (env.SMTP_USER) {
    options.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS || '' };
  }
  return nodemailer.createTransport(options);
}

/**
 * @param {{ to: string; subject: string; text: string; html: string }} payload
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
 * @param {{ to: string; resetUrl: string; userName: string; ttlMinutes: number }} params
 */
export async function sendPasswordResetEmail({ to, resetUrl, userName, ttlMinutes }) {
  const subject = 'Сброс пароля — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
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
    <p>${greeting}</p>
    <p>Вы запросили сброс пароля для личного кабинета.</p>
    <p><a href="${resetUrl}">Сбросить пароль</a></p>
    <p>Ссылка действует ${ttlMinutes} мин.</p>
    <p style="color:#666;font-size:14px">Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}

/**
 * @param {{ to: string; code: string; userName: string; ttlMinutes: number; verifyUrl: string }} params
 */
export async function sendEmailVerificationEmail({ to, code, userName, ttlMinutes, verifyUrl }) {
  const subject = 'Подтверждение email — Автоассистент';
  const greeting = userName ? `Здравствуйте, ${userName}!` : 'Здравствуйте!';
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
    <p>${greeting}</p>
    <p>Для завершения регистрации введите код подтверждения:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em">${code}</p>
    <p>Код действует ${ttlMinutes} мин.</p>
    <p><a href="${verifyUrl}">Подтвердить email</a></p>
    <p style="color:#666;font-size:14px">Если вы не регистрировались, проигнорируйте это письмо.</p>
  `.trim();

  await sendMail({ to, subject, text, html });
}
