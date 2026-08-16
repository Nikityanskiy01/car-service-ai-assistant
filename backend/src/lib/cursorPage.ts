/** Opaque cursor: `{ id, t }` where `t` is an ISO timestamp used for keyset pagination. */

export function encodeCursor(payload: { id: string; t: string }) {
  return Buffer.from(JSON.stringify({ id: payload.id, t: payload.t }), 'utf8').toString('base64url');
}

export function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    const id = String(parsed?.id || '').trim();
    const t = String(parsed?.t || '').trim();
    if (!id || !t) return null;
    return { id, t };
  } catch {
    return null;
  }
}

export function nextCursorFromPage(items, { limit, getCursor }) {
  if (!Array.isArray(items) || items.length < Number(limit)) return null;
  const last = items[items.length - 1];
  if (!last) return null;
  const payload = getCursor(last);
  return payload ? encodeCursor(payload) : null;
}
