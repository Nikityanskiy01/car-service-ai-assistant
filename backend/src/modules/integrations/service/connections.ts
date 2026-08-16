import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { encryptSecret, maskSecret } from '../integrationEncryption.service.js';
import { getAdapter } from '../integrationRegistry.service.js';
import { getConnectionOrThrow, mapConnection, parseConfig, withDecryptedSecrets } from './helpers.js';

export async function listConnections() {
  const rows = await prisma.integrationConnection.findMany({
    orderBy: [{ provider: 'asc' }, { createdAt: 'desc' }],
    include: { credentials: true },
  });
  return rows.map((x) => mapConnection(x, x.credentials));
}

export async function createConnection(payload) {
  const provider = String(payload?.provider || '').toUpperCase();
  const adapter = getAdapter(provider);
  if (!adapter) {
    throw new AppError(
      400,
      'Для выбранной системы доступен только режим карточки возможностей. Активный адаптер пока не реализован.',
      'UNSUPPORTED_PROVIDER',
    );
  }
  const config = parseConfig(payload?.config);
  const validation = await adapter.validateConfiguration(config);
  if (!validation.ok) {
    throw new AppError(400, validation.errors.join('. '), 'BAD_REQUEST');
  }
  const capabilities = await adapter.getCapabilities();
  return prisma.$transaction(async (tx) => {
    const created = await tx.integrationConnection.create({
      data: {
        tenantId: 'default',
        name: String(payload?.name || provider),
        provider: provider as any,
        versionLabel: payload?.versionLabel ? String(payload.versionLabel) : null,
        mode: String(payload?.mode || 'api'),
        status: 'REQUIRES_SETUP',
        enabled: false,
        capabilitiesJson: capabilities,
        configJson: config,
      },
    });
    await tx.integrationAuditEvent.create({
      data: {
        connectionId: created.id,
        level: 'INFO',
        action: 'CONNECTION_CREATED',
        entityType: 'integration_connection',
        entityId: created.id,
        payloadJson: { provider, mode: created.mode },
      },
    });
    if (payload?.credentials && typeof payload.credentials === 'object') {
      const entries = Object.entries(payload.credentials)
        .map(([key, value]) => [String(key), value == null ? '' : String(value)])
        .filter(([, value]) => value.trim().length > 0);
      if (entries.length) {
        await tx.integrationCredential.createMany({
          data: entries.map(([key, value]) => ({
            connectionId: created.id,
            key,
            encryptedValue: encryptSecret(value),
            maskedValue: maskSecret(value),
          })),
        });
      }
    }
    return getConnectionOrThrow(created.id);
  });
}

export async function patchConnection(connectionId, payload) {
  const current = await getConnectionOrThrow(connectionId);
  const data: any = {};
  if (payload?.name !== undefined) data.name = String(payload.name || '').trim() || current.name;
  if (payload?.versionLabel !== undefined) data.versionLabel = payload.versionLabel ? String(payload.versionLabel) : null;
  if (payload?.mode !== undefined) data.mode = String(payload.mode || current.mode);
  if (payload?.config !== undefined) data.configJson = parseConfig(payload.config);
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      await tx.integrationConnection.update({ where: { id: connectionId }, data });
    }
    if (payload?.credentials && typeof payload.credentials === 'object') {
      const entries = Object.entries(payload.credentials)
        .map(([key, value]) => [String(key), value == null ? '' : String(value)])
        .filter(([, value]) => value.trim().length > 0);
      for (const [key, value] of entries) {
        await tx.integrationCredential.upsert({
          where: { connectionId_key: { connectionId, key } },
          create: {
            connectionId,
            key,
            encryptedValue: encryptSecret(value),
            maskedValue: maskSecret(value),
          },
          update: {
            encryptedValue: encryptSecret(value),
            maskedValue: maskSecret(value),
          },
        });
      }
    }
    await tx.integrationAuditEvent.create({
      data: {
        connectionId,
        level: 'INFO',
        action: 'CONNECTION_UPDATED',
        entityType: 'integration_connection',
        entityId: connectionId,
        payloadJson: { changed: Object.keys(data) },
      },
    });
  });
  return getConnectionOrThrow(connectionId);
}

export async function deleteConnection(connectionId) {
  await getConnectionOrThrow(connectionId);
  await prisma.integrationConnection.delete({ where: { id: connectionId } });
}

export async function setConnectionEnabled(connectionId, enabled) {
  await getConnectionOrThrow(connectionId);
  const row = await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { enabled: Boolean(enabled), status: enabled ? 'CONNECTED' : 'PAUSED' },
    include: { credentials: true },
  });
  return mapConnection(row, row.credentials);
}

export async function getCapabilities(connectionId) {
  const row = await getConnectionOrThrow(connectionId);
  return row.capabilitiesJson || null;
}

export async function testConnection(connectionId) {
  const row = await getConnectionOrThrow(connectionId);
  const adapter = getAdapter(row.provider);
  if (!adapter) throw new AppError(400, 'Тест подключения для провайдера пока недоступен', 'UNSUPPORTED_PROVIDER');
  const config = withDecryptedSecrets(row);
  await prisma.integrationConnection.update({ where: { id: connectionId }, data: { status: 'TESTING' } });
  const result = await adapter.testConnection(config);
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      status: result.ok ? 'CONNECTED' : 'UNAVAILABLE',
      lastErrorCode: result.ok ? null : 'CONNECTION_TEST_FAILED',
      lastErrorMessage: result.ok ? null : String(result.message || 'Ошибка проверки'),
    },
  });
  await prisma.integrationAuditEvent.create({
    data: {
      connectionId,
      action: 'CONNECTION_TESTED',
      level: result.ok ? 'INFO' : 'WARN',
      entityType: 'integration_connection',
      entityId: connectionId,
      payloadJson: { ok: result.ok, httpStatus: result.httpStatus, latencyMs: result.latencyMs },
    },
  });
  return result;
}
