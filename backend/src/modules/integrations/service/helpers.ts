import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { decryptSecret } from '../integrationEncryption.service.js';

export const MAX_RETRIES = 5;

export function parseConfig(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  return { ...json };
}

export function mapConnection(row, credentials = []) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    provider: row.provider,
    versionLabel: row.versionLabel,
    mode: row.mode,
    status: row.status,
    enabled: row.enabled,
    capabilities: row.capabilitiesJson || null,
    config: row.configJson || null,
    lastSyncAt: row.lastSyncAt?.toISOString?.() || null,
    lastErrorCode: row.lastErrorCode || null,
    lastErrorMessage: row.lastErrorMessage || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    credentials: credentials.map((c) => ({ key: c.key, maskedValue: c.maskedValue })),
  };
}

export async function getConnectionOrThrow(connectionId) {
  const row = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    include: { credentials: true },
  });
  if (!row) throw new AppError(404, 'Подключение не найдено', 'NOT_FOUND');
  return row;
}

export function withDecryptedSecrets(connection) {
  const out = parseConfig(connection.configJson);
  for (const cred of connection.credentials || []) {
    try {
      out[cred.key] = decryptSecret(cred.encryptedValue);
    } catch {
      out[cred.key] = null;
    }
  }
  return out;
}

export function classifyRetryable(errorCode) {
  const code = String(errorCode || '').toUpperCase();
  if (code.includes('429') || code.includes('TIMEOUT') || code.includes('503') || code.includes('NETWORK')) return true;
  return false;
}
