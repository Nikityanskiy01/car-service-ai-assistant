export type ClientDeviceMeta = {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string | null;
  browser: string | null;
  label: string;
  isBot: boolean;
};

export function loginMethodLabel(method: string) {
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

export function formatRelativeTime(iso: string, now = Date.now()) {
  try {
    const date = new Date(iso);
    const diffMs = now - date.getTime();
    if (diffMs < 0) return 'только что';
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
    return formatDateTime(iso);
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatShortDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatSessionExpiry(iso: string, now = Date.now()) {
  try {
    const expires = new Date(iso).getTime();
    const diffMs = expires - now;
    if (diffMs <= 0) return 'истекла';
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (days <= 1) return 'до конца дня';
    return `ещё ${days} дн`;
  } catch {
    return '';
  }
}

export function deviceTitle(device: ClientDeviceMeta | null | undefined) {
  if (!device?.label) return 'Неизвестное устройство';
  return device.label;
}

export function ipDescription(ipLabel: string | null | undefined, ipKind: string | null | undefined) {
  if (!ipLabel) return 'IP не определён';
  if (ipKind === 'public') return `IP ${ipLabel}`;
  return ipLabel;
}
