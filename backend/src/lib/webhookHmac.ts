import crypto from 'crypto';

/**
 * Verify HMAC-SHA256 webhook signature.
 * Accepts `sha256=<hex>` or bare hex in x-signature / x-hook-signature / x-hub-signature-256.
 * @param rawBody
 * @param signatureHeader
 * @param secret
 */
export function verifyWebhookHmac(rawBody, signatureHeader, secret) {
  const key = String(secret || '').trim();
  const header = String(signatureHeader || '').trim();
  if (!key || !header) return false;

  let provided = header;
  const lower = header.toLowerCase();
  if (lower.startsWith('sha256=')) provided = header.slice(7).trim();
  else if (lower.startsWith('sha-256=')) provided = header.slice(8).trim();

  if (!/^[0-9a-f]+$/i.test(provided) || provided.length !== 64) return false;

  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const expected = crypto.createHmac('sha256', key).update(bodyBuf).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function pickWebhookSignatureHeader(headers: any = {}) {
  const h = headers || {};
  return (
    h['x-hub-signature-256'] ||
    h['x-signature'] ||
    h['x-hook-signature'] ||
    h['x-webhook-signature'] ||
    ''
  );
}
