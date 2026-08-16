import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { getConnectionOrThrow } from './helpers.js';
import { dispatchOutbox, processPendingJobs } from './outbox.js';

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
