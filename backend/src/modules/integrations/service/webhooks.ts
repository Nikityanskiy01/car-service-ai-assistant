import prisma from '../../../lib/prisma.js';
import { AppError, isAppError } from '../../../lib/errors.js';
import { pickWebhookSignatureHeader, verifyWebhookHmac } from '../../../lib/webhookHmac.js';
import { getConnectionOrThrow, withDecryptedSecrets } from './helpers.js';

export async function handleIncomingWebhook(connectionId, payload, headers: any = {}, rawBody = null) {
  const id = String(connectionId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError(404, 'Webhook-эндпоинт не найден.', 'NOT_FOUND');
  }

  let connection;
  try {
    connection = await getConnectionOrThrow(id);
  } catch (err) {
    if (isAppError(err) && err.statusCode === 404) {
      throw new AppError(404, 'Webhook-эндпоинт не найден.', 'NOT_FOUND');
    }
    throw err;
  }
  if (!connection.enabled) {
    throw new AppError(404, 'Webhook-эндпоинт не найден.', 'NOT_FOUND');
  }

  const secrets = withDecryptedSecrets(connection);
  const webhookSecret = String(secrets.webhookSecret || secrets.webhook_secret || '').trim();
  if (!webhookSecret) {
    throw new AppError(401, 'Секрет webhook не настроен.', 'WEBHOOK_UNAUTHORIZED');
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
    throw new AppError(401, 'Неверная подпись webhook.', 'WEBHOOK_UNAUTHORIZED');
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
