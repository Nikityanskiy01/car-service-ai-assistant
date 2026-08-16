import dns from 'node:dns/promises';
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
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice(7));
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  if (normalized.startsWith('64:ff9b:')) return true;
  return false;
}

function assertHostSafe(host) {
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
}

/**
 * @param urlString
 * @param [opts]
 */
export function assertSafeOutboundUrl(urlString, opts: any = {}) {
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
    // ok
  } else {
    throw new AppError(400, 'Разрешены только HTTPS URL внешних систем', 'BAD_REQUEST');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  assertHostSafe(host);
  return url;
}

export async function assertSafeOutboundUrlResolved(urlString, opts: any = {}) {
  const url = assertSafeOutboundUrl(urlString, opts);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIP(host)) return url;
  let records;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new AppError(400, 'Не удалось разрешить хост внешней системы', 'BAD_REQUEST');
  }
  for (const row of records || []) {
    const ip = String(row.address || '').replace(/^\[|\]$/g, '').toLowerCase();
    if (!ip) continue;
    if (net.isIP(ip) === 4 && isPrivateIpv4(ip)) {
      throw new AppError(400, 'Запрещён доступ к частным IP-адресам', 'BAD_REQUEST');
    }
    if (net.isIP(ip) === 6 && isPrivateIpv6(ip)) {
      throw new AppError(400, 'Запрещён доступ к частным IP-адресам', 'BAD_REQUEST');
    }
  }
  return url;
}

export function joinSafeUrl(baseUrl, path = '/') {
  const base = assertSafeOutboundUrl(baseUrl, { allowHttp: true });
  const suffix = String(path || '/');
  if (/^https?:\/\//i.test(suffix) || suffix.startsWith('//')) {
    throw new AppError(400, 'Путь внешней системы не должен быть абсолютным URL', 'BAD_REQUEST');
  }
  const baseNoSlash = `${base.origin}${base.pathname}`.replace(/\/+$/, '');
  const joined = `${baseNoSlash}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
  assertSafeOutboundUrl(joined, { allowHttp: true });
  return joined;
}

function pickPublicAddress(records) {
  const rows = (records || []).map((row) => String(row.address || '').replace(/^\[|\]$/g, '').toLowerCase());
  const v4 = rows.find((ip) => net.isIP(ip) === 4 && !isPrivateIpv4(ip));
  if (v4) return { address: v4, family: 4 };
  const v6 = rows.find((ip) => net.isIP(ip) === 6 && !isPrivateIpv6(ip));
  if (v6) return { address: v6, family: 6 };
  return null;
}

/**
 * Resolve, pin IP, then fetch with original Host / TLS SNI to close DNS TOCTOU.
 */
export async function fetchSafeOutbound(urlString, init: any = {}, opts: any = {}) {
  const url = assertSafeOutboundUrl(urlString, opts);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  let target = url;
  let dispatcher;
  if (!net.isIP(host)) {
    let records;
    try {
      records = await dns.lookup(host, { all: true, verbatim: true });
    } catch {
      throw new AppError(400, 'Не удалось разрешить хост внешней системы', 'BAD_REQUEST');
    }
    const picked = pickPublicAddress(records);
    if (!picked) {
      throw new AppError(400, 'Запрещён доступ к частным IP-адресам', 'BAD_REQUEST');
    }
    target = new URL(url);
    target.hostname = picked.family === 6 ? `[${picked.address}]` : picked.address;
    const { Agent } = await import('undici' as any);
    dispatcher = new Agent({ connect: { servername: host } });
  }
  const headers = new Headers((init.headers || {}) as any);
  if (!headers.has('Host')) headers.set('Host', host);
  return fetch(target, { ...init, headers, dispatcher, redirect: 'error' });
}
