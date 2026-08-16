import crypto from 'crypto';

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function normalizeClientIp(ip) {
  if (!ip) return null;
  let value = String(ip).trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value || null;
}

export function formatClientIp(ip) {
  const value = normalizeClientIp(ip);
  if (!value) return { display: null, kind: 'unknown', raw: null };

  if (value === '127.0.0.1' || value === '::1') {
    return { display: 'Локальный адрес', kind: 'local', raw: value };
  }
  if (
    /^10\./.test(value) ||
    /^192\.168\./.test(value) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value) ||
    /^fe80:/i.test(value)
  ) {
    return { display: 'Локальная сеть', kind: 'private', raw: value };
  }
  return { display: value, kind: 'public', raw: value };
}

export function deviceSessionKey(ip, userAgent) {
  return `${normalizeClientIp(ip) || ''}|${String(userAgent || '').slice(0, 500)}`;
}

const SCRIPT_MATCHERS = [
  {
    test: (text) =>
      /^node$/i.test(text.trim()) ||
      /^node\//i.test(text) ||
      /\bnode-fetch\b/i.test(text) ||
      /\bundici\b/i.test(text),
    label: () => 'Node.js',
  },
  {
    test: (text) => /curl\//i.test(text),
    label: (text) => {
      const match = text.match(/curl\/([\d.]+)/i);
      return match ? `curl ${match[1]}` : 'curl';
    },
  },
  { test: (text) => /PostmanRuntime/i.test(text), label: () => 'Postman' },
  { test: (text) => /python-requests/i.test(text), label: () => 'Python' },
  { test: (text) => /^axios\//i.test(text) || /axios\/\d/i.test(text), label: () => 'Axios' },
  { test: (text) => /^wget\//i.test(text) || /\bwget\//i.test(text), label: () => 'wget' },
  { test: (text) => /^Go-http-client/i.test(text), label: () => 'Go' },
  { test: (text) => /^HTTPie\//i.test(text), label: () => 'HTTPie' },
];

export function scriptClientName(userAgent) {
  if (!userAgent) return null;
  const text = String(userAgent);
  const match = SCRIPT_MATCHERS.find((item) => item.test(text));
  return match ? match.label(text) : null;
}

export function isScriptUserAgent(userAgent) {
  return Boolean(scriptClientName(userAgent));
}

export function parseUserAgent(ua) {
  if (!ua) {
    return {
      deviceType: 'unknown',
      os: null,
      browser: null,
      label: 'Неизвестное устройство',
      isBot: false,
    };
  }

  const text = String(ua);
  const scriptName = scriptClientName(text);
  if (scriptName) {
    return {
      deviceType: 'desktop',
      os: null,
      browser: scriptName,
      label: `Скрипт · ${scriptName}`,
      isBot: true,
    };
  }

  let os = null;
  if (/iPhone|iPod/i.test(text)) os = 'iOS';
  else if (/iPad/i.test(text)) os = 'iPadOS';
  else if (/Android/i.test(text)) os = 'Android';
  else if (/Windows NT/i.test(text)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(text)) os = 'macOS';
  else if (/Linux/i.test(text)) os = 'Linux';

  let browser = null;
  if (/Edg\//i.test(text)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(text)) browser = 'Opera';
  else if (/Chrome\//i.test(text) && !/Edg\//i.test(text)) browser = 'Chrome';
  else if (/Safari\//i.test(text) && !/Chrome/i.test(text)) browser = 'Safari';
  else if (/Firefox\//i.test(text)) browser = 'Firefox';

  let deviceType = 'desktop';
  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(text)) deviceType = 'mobile';
  else if (/iPad|Tablet/i.test(text)) deviceType = 'tablet';

  const parts = [browser, os].filter(Boolean);
  const label = parts.length ? parts.join(' · ') : text.slice(0, 48);

  return { deviceType, os, browser, label, isBot: false };
}

export function loginReasonLabel(reason) {
  switch (reason) {
    case 'bad_password':
      return 'Неверный пароль';
    case 'bad_totp':
      return 'Неверный код двухфакторной защиты';
    case 'bad_disable':
      return 'Не удалось отключить защиту';
    case 'bad_otp':
      return 'Неверный или просроченный код';
    case 'blocked':
      return 'Аккаунт заблокирован';
    default:
      return reason ? String(reason) : null;
  }
}

export function loginMethodLabel(method) {
  switch (method) {
    case 'totp':
      return 'Код из приложения';
    case 'backup':
      return 'Резервный код';
    case 'totp_disable':
      return 'Отключение защиты';
    case 'email_otp':
      return 'Код на почту';
    case 'sms':
      return 'Код в SMS';
    case 'telegram':
      return 'Telegram';
    default:
      return 'Пароль';
  }
}

export function enrichClientMeta({ ip, userAgent }) {
  const device = parseUserAgent(userAgent);
  const ipInfo = formatClientIp(ip);
  return {
    device,
    ipLabel: ipInfo.display,
    ipKind: ipInfo.kind,
  };
}
