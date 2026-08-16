import crypto from 'crypto';
import { getEnv } from '../../config/env.js';

function resolveEncryptionKey() {
  const env = getEnv();
  const dedicated = String(env.INTEGRATION_ENCRYPTION_KEY || '').trim();
  if (env.NODE_ENV === 'production' && dedicated.length < 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY (min 32 chars) is required in production');
  }
  // Dev/test fallback to JWT_SECRET only when dedicated key is absent.
  const raw = dedicated || String(env.JWT_SECRET || '');
  if (!raw) throw new Error('INTEGRATION_ENCRYPTION_KEY or JWT_SECRET is required');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(value) {
  const plain = String(value || '');
  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload) {
  const buf = Buffer.from(String(payload || ''), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = resolveEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskSecret(secret) {
  const value = String(secret || '').trim();
  if (!value) return '***';
  if (value.length <= 6) return `${value[0]}***${value[value.length - 1]}`;
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
