import { assertSafeOutboundUrl, fetchSafeOutbound } from '../../../lib/safeOutboundUrl.js';

export function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export function normalizeError(err) {
  const msg = err instanceof Error ? err.message : String(err || 'unknown');
  return msg.slice(0, 300);
}

export function pickUrl(config, keys, fallback = '') {
  for (const key of keys) {
    const value = String(config?.[key] || '').trim();
    if (value) return value.replace(/\/+$/, '');
  }
  return fallback;
}

export function pickToken(config) {
  return String(config?.token || config?.apiToken || config?.webhookToken || '').trim();
}

export function validateHttpsUrl(url, errors, label = 'URL') {
  if (!url) {
    errors.push(`Укажите ${label}`);
    return;
  }
  try {
    assertSafeOutboundUrl(url, { allowHttp: false });
  } catch (err) {
    errors.push(err?.message || `Небезопасный ${label}`);
  }
}

export async function timedGet(url, headers, timeoutMs) {
  const startedAt = Date.now();
  try {
    const res = await fetchSafeOutbound(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      },
      { allowHttp: false },
    );
    const text = await res.text().catch(() => '');
    return {
      ok: res.ok,
      httpStatus: res.status,
      latencyMs: Date.now() - startedAt,
      message: res.ok ? 'Подключение успешно' : `Внешняя система ответила со статусом ${res.status}`,
      details: safeJsonParse(text) || text.slice(0, 300),
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      message: 'Не удалось подключиться к внешней системе',
      details: normalizeError(err),
    };
  }
}

export async function timedPost(url, headers, body, timeoutMs) {
  const isRaw = typeof body === 'string';
  const res = await fetchSafeOutbound(
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(isRaw ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: isRaw ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    },
    { allowHttp: false },
  );
  const text = await res.text().catch(() => '');
  return { res, text, parsed: safeJsonParse(text) || {} };
}
