import crypto from 'crypto';

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** @param {string | null | undefined} ip */
export function formatClientIp(ip) {
  if (!ip) return { display: null, kind: 'unknown', raw: null };
  let value = String(ip).trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);

  if (value === '127.0.0.1' || value === '::1') {
    return { display: 'Это устройство', kind: 'local', raw: value };
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

function detectBot(text) {
  if (/curl\//i.test(text)) {
    const match = text.match(/curl\/([\d.]+)/i);
    return match ? `curl ${match[1]}` : 'curl';
  }
  if (/PostmanRuntime/i.test(text)) return 'Postman';
  if (/python-requests/i.test(text)) return 'Python';
  if (/axios/i.test(text)) return 'Axios';
  if (/node-fetch/i.test(text)) return 'Node.js';
  if (/wget/i.test(text)) return 'wget';
  return text.slice(0, 32);
}

/** @param {string | null | undefined} ua */
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
  if (/curl|wget|python-requests|axios|node-fetch|PostmanRuntime/i.test(text)) {
    const bot = detectBot(text);
    return {
      deviceType: 'desktop',
      os: null,
      browser: bot,
      label: bot,
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
