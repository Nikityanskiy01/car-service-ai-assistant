import prisma from '../../lib/prisma.js';
import { AppError, isAppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { pickWebhookSignatureHeader, verifyWebhookHmac } from '../../lib/webhookHmac.js';
import { decryptSecret, encryptSecret, maskSecret } from './integrationEncryption.service.js';
import { getAdapter } from './integrationRegistry.service.js';
import { toCanonicalServiceRequest } from './integrationMapper.service.js';

const MAX_RETRIES = 5;

function parseConfig(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  return { ...json };
}

function mapConnection(row, credentials = []) {
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

async function getConnectionOrThrow(connectionId) {
  const row = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    include: { credentials: true },
  });
  if (!row) throw new AppError(404, 'Подключение не найдено', 'NOT_FOUND');
  return row;
}

function withDecryptedSecrets(connection) {
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

function classifyRetryable(errorCode) {
  const code = String(errorCode || '').toUpperCase();
  if (code.includes('429') || code.includes('TIMEOUT') || code.includes('503') || code.includes('NETWORK')) return true;
  return false;
}

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
        provider,
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
  const data = {};
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

export async function enqueueOutboxEvent({ eventType, entityType, entityId, payloadJson }) {
  const activeConnections = await prisma.integrationConnection.findMany({
    where: { enabled: true, status: { in: ['CONNECTED', 'LIMITED'] } },
    select: { id: true },
  });
  if (!activeConnections.length) return { queued: 0 };
  const now = Date.now();
  await prisma.$transaction(
    activeConnections.map((conn, idx) =>
      prisma.integrationOutboxEvent.create({
        data: {
          connectionId: conn.id,
          eventType,
          entityType,
          entityId,
          idempotencyKey: `${entityType}:${entityId}:${eventType}:${now}:${idx}`,
          payloadJson: payloadJson || null,
        },
      }),
    ),
  );
  return { queued: activeConnections.length };
}

export async function dispatchOutbox(connectionId = null) {
  const where = {
    status: 'PENDING',
    ...(connectionId ? { connectionId } : {}),
  };
  const outboxItems = await prisma.integrationOutboxEvent.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  for (const event of outboxItems) {
    await prisma.$transaction([
      prisma.integrationJob.create({
        data: {
          connectionId: event.connectionId,
          eventType: event.eventType,
          entityType: event.entityType,
          entityId: event.entityId,
          idempotencyKey: event.idempotencyKey,
          status: 'PENDING',
          payloadJson: event.payloadJson || null,
        },
      }),
      prisma.integrationOutboxEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      }),
    ]);
  }
  return { dispatched: outboxItems.length };
}

async function pushRequestJob(job) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: job.connectionId },
    include: { credentials: true },
  });
  if (!connection) throw new Error('CONNECTION_NOT_FOUND');
  const adapter = getAdapter(connection.provider);
  if (!adapter) throw new Error('UNSUPPORTED_PROVIDER');
  const config = withDecryptedSecrets(connection);
  if (job.entityType !== 'service_request') {
    return { skipped: true };
  }
  const request = await prisma.serviceRequest.findUnique({
    where: { id: job.entityId },
    include: {
      client: true,
      consultationSession: {
        include: {
          extracted: true,
          recommendations: true,
        },
      },
    },
  });
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  const canonical = toCanonicalServiceRequest(request);
  const ext = await adapter.pushServiceRequest(canonical, {
    idempotencyKey: job.idempotencyKey,
    config,
  });
  if (!ext?.externalEntityId) throw new Error('EMPTY_EXTERNAL_ID');
  await prisma.externalEntityLink.upsert({
    where: {
      connectionId_internalEntityType_internalEntityId_externalEntityType: {
        connectionId: connection.id,
        internalEntityType: 'service_request',
        internalEntityId: request.id,
        externalEntityType: 'service_request',
      },
    },
    create: {
      connectionId: connection.id,
      internalEntityType: 'service_request',
      internalEntityId: request.id,
      externalEntityType: 'service_request',
      externalEntityId: String(ext.externalEntityId),
      externalUrl: ext.externalUrl || null,
      externalVersion: null,
    },
    update: {
      externalEntityId: String(ext.externalEntityId),
      externalUrl: ext.externalUrl || null,
      synchronizedAt: new Date(),
    },
  });
  return ext;
}

export async function processPendingJobs() {
  const jobs = await prisma.integrationJob.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'RETRYING', nextAttemptAt: { lte: new Date() } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });
  for (const job of jobs) {
    const startedAt = Date.now();
    await prisma.integrationJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING' },
    });
    try {
      await pushRequestJob(job);
      const now = new Date();
      await prisma.$transaction([
        prisma.integrationJob.update({
          where: { id: job.id },
          data: {
            status: 'SUCCEEDED',
            attemptCount: { increment: 1 },
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        }),
        prisma.integrationAttempt.create({
          data: {
            jobId: job.id,
            success: true,
            completedAt: now,
            durationMs: Date.now() - startedAt,
          },
        }),
        prisma.integrationConnection.update({
          where: { id: job.connectionId },
          data: { lastSyncAt: now, status: 'CONNECTED', lastErrorCode: null, lastErrorMessage: null },
        }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || 'UNKNOWN');
      const retryable = classifyRetryable(message);
      const nextAttempt = retryable && job.attemptCount + 1 < MAX_RETRIES ? new Date(Date.now() + 60_000 * (job.attemptCount + 1)) : null;
      const nextStatus = retryable && nextAttempt ? 'RETRYING' : job.attemptCount + 1 >= MAX_RETRIES ? 'DEAD_LETTER' : 'FAILED';
      await prisma.$transaction([
        prisma.integrationJob.update({
          where: { id: job.id },
          data: {
            status: nextStatus,
            attemptCount: { increment: 1 },
            nextAttemptAt: nextAttempt,
            lastErrorCode: 'DISPATCH_FAILED',
            lastErrorMessage: message.slice(0, 500),
          },
        }),
        prisma.integrationAttempt.create({
          data: {
            jobId: job.id,
            success: false,
            completedAt: new Date(),
            errorCode: 'DISPATCH_FAILED',
            errorMessage: message.slice(0, 500),
            durationMs: Date.now() - startedAt,
          },
        }),
        prisma.integrationConnection.update({
          where: { id: job.connectionId },
          data: { status: 'UNAVAILABLE', lastErrorCode: 'DISPATCH_FAILED', lastErrorMessage: message.slice(0, 240) },
        }),
      ]);
      logger.warn({ jobId: job.id, message }, 'integration job failed');
    }
  }
  return { processed: jobs.length };
}

export async function listJobs(connectionId, { status, page = 1, pageSize = 20 } = {}) {
  const where = {
    connectionId,
    ...(status ? { status } : {}),
  };
  const take = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  const [items, total] = await prisma.$transaction([
    prisma.integrationJob.findMany({
      where,
      include: { attempts: { orderBy: { startedAt: 'desc' }, take: 3 } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.integrationJob.count({ where }),
  ]);
  return { items, total, page: Math.max(1, Number(page) || 1), pageSize: take };
}

export async function listConflicts(connectionId) {
  const rows = await prisma.integrationConflict.findMany({
    where: connectionId ? { connectionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { connection: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    connectionName: r.connection?.name || null,
    entityType: r.entityType,
    entityId: r.internalEntityId,
    fieldName: r.field,
    localValue: r.localValue,
    externalValue: r.externalValue,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function resolveConflict(conflictId, resolution, note) {
  const statusMap = {
    KEEP_LOCAL: 'RESOLVED_LOCAL',
    ACCEPT_EXTERNAL: 'RESOLVED_EXTERNAL',
    MERGE: 'RESOLVED_MERGED',
    POSTPONE: 'POSTPONED',
  };
  const status = statusMap[String(resolution || '').toUpperCase()];
  if (!status) throw new AppError(400, 'Некорректный вариант разрешения конфликта', 'BAD_REQUEST');
  return prisma.integrationConflict.update({
    where: { id: conflictId },
    data: {
      status,
      resolutionNote: note ? String(note).slice(0, 500) : null,
      resolvedAt: ['POSTPONED'].includes(status) ? null : new Date(),
    },
  });
}

export async function listAuditLogs(connectionId) {
  return prisma.integrationAuditEvent.findMany({
    where: connectionId ? { connectionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function retryJob(jobId) {
  const row = await prisma.integrationJob.findUnique({ where: { id: jobId } });
  if (!row) throw new AppError(404, 'Задача синхронизации не найдена', 'NOT_FOUND');
  await prisma.integrationJob.update({
    where: { id: jobId },
    data: {
      status: 'PENDING',
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
  return processPendingJobs();
}

export async function cancelJob(jobId) {
  await prisma.integrationJob.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
  });
}

export async function handleIncomingWebhook(connectionId, payload, headers = {}, rawBody = null) {
  const id = String(connectionId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError(404, 'Webhook endpoint not found', 'NOT_FOUND');
  }

  let connection;
  try {
    connection = await getConnectionOrThrow(id);
  } catch (err) {
    if (isAppError(err) && err.statusCode === 404) {
      throw new AppError(404, 'Webhook endpoint not found', 'NOT_FOUND');
    }
    throw err;
  }
  if (!connection.enabled) {
    throw new AppError(404, 'Webhook endpoint not found', 'NOT_FOUND');
  }

  const secrets = withDecryptedSecrets(connection);
  const webhookSecret = String(secrets.webhookSecret || secrets.webhook_secret || '').trim();
  if (!webhookSecret) {
    throw new AppError(401, 'Webhook secret is not configured', 'WEBHOOK_UNAUTHORIZED');
  }

  const signatureHeader = pickWebhookSignatureHeader(headers);
  const bodyForMac =
    rawBody && (Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8'));
  const fallbackBody = Buffer.from(JSON.stringify(payload ?? null), 'utf8');
  const signatureValid =
    verifyWebhookHmac(bodyForMac || fallbackBody, signatureHeader, webhookSecret) ||
    (bodyForMac ? verifyWebhookHmac(fallbackBody, signatureHeader, webhookSecret) : false);

  if (!signatureValid) {
    await prisma.integrationAuditEvent.create({
      data: {
        connectionId: id,
        level: 'WARN',
        action: 'WEBHOOK_REJECTED',
        entityType: 'integration_connection',
        entityId: id,
        payloadJson: { reason: 'invalid_signature', signaturePresent: Boolean(signatureHeader) },
      },
    });
    throw new AppError(401, 'Invalid webhook signature', 'WEBHOOK_UNAUTHORIZED');
  }

  const eventId = String(headers['x-event-id'] || headers['x-request-id'] || headers['x-correlation-id'] || '');
  const safeHeaders = {
    'content-type': headers['content-type'] || null,
    'user-agent': headers['user-agent'] || null,
    'x-event-id': headers['x-event-id'] || null,
    'x-request-id': headers['x-request-id'] || null,
  };
  const row = await prisma.integrationWebhookEvent.create({
    data: {
      connectionId: id,
      eventId: eventId || null,
      payloadJson: payload || null,
      headersJson: safeHeaders,
      signatureValid: true,
      status: 'RECEIVED',
    },
  });
  await prisma.integrationAuditEvent.create({
    data: {
      connectionId: id,
      level: 'INFO',
      action: 'WEBHOOK_RECEIVED',
      entityType: 'integration_webhook_event',
      entityId: row.id,
      payloadJson: { eventId: row.eventId, signatureValid: true },
    },
  });
  return row;
}

export async function getRequestIntegrationStatus(requestId) {
  const links = await prisma.externalEntityLink.findMany({
    where: { internalEntityType: 'service_request', internalEntityId: requestId },
    include: { connection: true },
  });
  const jobs = await prisma.integrationJob.findMany({
    where: { entityType: 'service_request', entityId: requestId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return {
    links: links.map((x) => ({
      connectionId: x.connectionId,
      connectionName: x.connection.name,
      provider: x.connection.provider,
      externalEntityId: x.externalEntityId,
      externalUrl: x.externalUrl,
      synchronizedAt: x.synchronizedAt.toISOString(),
    })),
    jobs,
  };
}

export async function exportRequestToConnection(requestId, connectionId) {
  const connection = await getConnectionOrThrow(connectionId);
  if (!connection.enabled) throw new AppError(409, 'Подключение выключено. Включите синхронизацию в админ-панели.', 'DISABLED');
  const idempotencyKey = `service-request:${requestId}:create:${connection.provider}`;
  await prisma.integrationOutboxEvent.upsert({
    where: {
      connectionId_idempotencyKey: {
        connectionId,
        idempotencyKey,
      },
    },
    create: {
      connectionId,
      eventType: 'request.created',
      entityType: 'service_request',
      entityId: requestId,
      idempotencyKey,
      payloadJson: null,
      status: 'PENDING',
    },
    update: {
      status: 'PENDING',
      errorMessage: null,
      processedAt: null,
    },
  });
  await dispatchOutbox(connectionId);
  await processPendingJobs();
  return getRequestIntegrationStatus(requestId);
}
