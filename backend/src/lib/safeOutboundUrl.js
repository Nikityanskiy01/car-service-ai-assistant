import net from 'net';
import { AppError } from './errors.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map((x) => Number(x));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('fe80')) return true; // link-local
  return false;
}

/**
 * Blocks SSRF to loopback / private / link-local / cloud metadata.
 * @param {string} urlString
 * @param {{ allowHttp?: boolean }} [opts]
 */
export function assertSafeOutboundUrl(urlString, opts = {}) {
  let url;
  try {
    url = new URL(String(urlString || ''));
  } catch {
    throw new AppError(400, 'Некорректный URL внешней системы', 'BAD_REQUEST');
  }

  const allowHttp = opts.allowHttp === true;
  if (url.protocol === 'https:') {
    // ok
  } else if (url.protocol === 'http:' && allowHttp) {
    // ok for local/dev adapters when explicitly allowed
  } else {
    throw new AppError(400, 'Разрешены только HTTPS URL внешних систем', 'BAD_REQUEST');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || BLOCKED_HOSTNAMES.has(host)) {
    throw new AppError(400, 'Запрещённый хост внешней системы', 'BAD_REQUEST');
  }

  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    throw new AppError(400, 'Запрещённый хост внешней системы', 'BAD_REQUEST');
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) {
    throw new AppError(400, 'Запрещён доступ к частным IP-адресам', 'BAD_REQUEST');
  }
  if (ipVersion === 6 && isPrivateIpv6(host)) {
    throw new AppError(400, 'Запрещён доступ к частным IP-адресам', 'BAD_REQUEST');
  }

  return url;
}

export function joinSafeUrl(baseUrl, path = '/') {
  const base = assertSafeOutboundUrl(baseUrl, { allowHttp: true });
  const baseNoSlash = `${base.origin}${base.pathname}`.replace(/\/+$/, '');
  const suffix = String(path || '/');
  const joined =
    suffix.startsWith('http://') || suffix.startsWith('https://')
      ? suffix
      : `${baseNoSlash}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
  assertSafeOutboundUrl(joined, { allowHttp: true });
  return joined;
}
