import prisma from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
import { getAdapter } from '../integrationRegistry.service.js';
import { toCanonicalServiceRequest } from '../integrationMapper.service.js';
import { classifyRetryable, MAX_RETRIES, withDecryptedSecrets } from './helpers.js';

export async function enqueueOutboxEvent({ eventType, entityType, entityId, payloadJson }: any) {
  const activeConnections = await prisma.integrationConnection.findMany({
    where: { enabled: true, status: { in: ['CONNECTED', 'LIMITED'] } },
    select: { id: true },
  });
  if (!activeConnections.length) return { queued: 0 };
  const created = await prisma.integrationOutboxEvent.createMany({
    data: activeConnections.map((conn) => ({
      connectionId: conn.id,
      eventType,
      entityType,
      entityId,
      idempotencyKey: `${entityType}:${entityId}:${eventType}`,
      payloadJson: payloadJson || null,
    })),
    skipDuplicates: true,
  });
  return { queued: created.count };
}

export async function dispatchOutbox(connectionId = null) {
  const where = {
    status: 'PENDING',
    ...(connectionId ? { connectionId } : {}),
  };
  const outboxItems = await prisma.integrationOutboxEvent.findMany({
    where: where as any,
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
