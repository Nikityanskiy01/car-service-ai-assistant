import { randomUUID } from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  MAX_ATTACHMENTS,
  readAttachmentFile,
  saveAttachmentFile,
  serializeAttachment,
  validateAttachmentInput,
} from '../../lib/requestMessageAttachments.js';
import { notifyManagerMessage } from '../notifications/clientNotify.service.js';

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);

function mapMessagesWithAttachments(messages, requestId) {
  return messages.map((m) => ({
    ...m,
    attachments: (m.attachments || []).map((a) => serializeAttachment(a, requestId)),
  }));
}

export function resolveDeliveryStatus(message, user, peerReadAt) {
  const authorId = message.authorId || message.author?.id;
  if (!user?.id || !authorId || authorId !== user.id) return null;
  if (peerReadAt && new Date(message.createdAt).getTime() <= new Date(peerReadAt).getTime()) {
    return 'read';
  }
  return 'sent';
}

function peerReadAtFor(user, req) {
  return user.role === 'CLIENT' ? req.staffMessagesReadAt : req.clientMessagesReadAt;
}

function withDeliveryStatus(messages, user, req) {
  const peerReadAt = peerReadAtFor(user, req);
  return messages.map((message) => ({
    ...message,
    deliveryStatus: resolveDeliveryStatus(message, user, peerReadAt),
  }));
}

export async function listMessages(requestId, user) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (user.role === 'CLIENT' && req.clientId !== user.id) {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  if (user.role === 'CLIENT' || user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') {
    const messages = await prisma.requestFollowUpMessage.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        attachments: true,
      },
    });
    if (user.role === 'CLIENT') {
      await prisma.serviceRequest.update({
        where: { id: requestId },
        data: { clientMessagesReadAt: new Date() },
      });
    } else {
      await prisma.serviceRequest.update({
        where: { id: requestId },
        data: { staffMessagesReadAt: new Date() },
      });
    }
    return withDeliveryStatus(mapMessagesWithAttachments(messages, requestId), user, req);
  }
  throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
}

function truncateText(value, max, empty = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return empty;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function vehicleTitle(make, model) {
  return [make, model].filter(Boolean).join(' ') || 'Обращение';
}

export async function listUnreadThreadsForClient(userId) {
  const rows: any[] = await prisma.$queryRaw`
    SELECT
      r.id AS request_id,
      r.snapshot_make,
      r.snapshot_model,
      r.snapshot_symptoms,
      COUNT(*)::int AS unread_count,
      (
        SELECT m2.body
        FROM request_follow_up_messages m2
        INNER JOIN users a2 ON a2.id = m2.author_id
        WHERE m2.request_id = r.id
          AND a2.role <> 'CLIENT'
          AND (r.client_messages_read_at IS NULL OR m2.created_at > r.client_messages_read_at)
        ORDER BY m2.created_at DESC
        LIMIT 1
      ) AS last_preview,
      MAX(m.created_at) AS last_message_at
    FROM request_follow_up_messages m
    INNER JOIN service_requests r ON r.id = m.request_id
    INNER JOIN users a ON a.id = m.author_id
    WHERE r.client_id = ${userId}
      AND a.role <> 'CLIENT'
      AND (r.client_messages_read_at IS NULL OR m.created_at > r.client_messages_read_at)
    GROUP BY r.id
    ORDER BY MAX(m.created_at) DESC
  `;

  const threads = (rows || []).map((row) => ({
    requestId: String(row.request_id ?? row.requestId),
    title: vehicleTitle(row.snapshot_make ?? row.snapshotMake, row.snapshot_model ?? row.snapshotModel),
    symptoms: truncateText(row.snapshot_symptoms ?? row.snapshotSymptoms ?? '', 72),
    unreadCount: Number(row.unread_count ?? row.unreadCount ?? 0),
    lastMessagePreview: truncateText(row.last_preview ?? row.lastPreview, 90, 'Вложение'),
    lastMessageAt: (row.last_message_at ?? row.lastMessageAt)
      ? new Date(row.last_message_at ?? row.lastMessageAt).toISOString()
      : new Date().toISOString(),
  }));

  return {
    count: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    threads,
  };
}

export async function countUnreadMessagesForClient(userId) {
  const { count } = await listUnreadThreadsForClient(userId);
  return count;
}

export async function postMessage(requestId, user, { body = '', attachments = [] }: any = {}) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (CLOSED.has(req.status)) {
    throw new AppError(409, 'Переписка по этой заявке закрыта.', 'THREAD_LOCKED');
  }

  const isClient = user.role === 'CLIENT' && req.clientId === user.id;
  const isStaff = user.role === 'MANAGER' || user.role === 'ADMINISTRATOR';
  if (!isClient && !isStaff) throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');

  const text = String(body || '').trim().slice(0, 8000);
  const files = Array.isArray(attachments) ? attachments.slice(0, MAX_ATTACHMENTS) : [];
  if (!text && !files.length) {
    throw new AppError(400, 'Укажите текст или прикрепите файл', 'BAD_REQUEST');
  }

  const prepared = files.map((f) => validateAttachmentInput(f));

  const msg = await prisma.$transaction(async (tx) => {
    const created = await tx.requestFollowUpMessage.create({
      data: {
        requestId,
        authorId: user.id,
        body: text,
      },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });

    const savedAttachments = [];
    for (const file of prepared) {
      const attachmentId = randomUUID();
      const storageKey = await saveAttachmentFile(file.buffer, attachmentId);
      const row = await tx.requestFollowUpAttachment.create({
        data: {
          id: attachmentId,
          messageId: created.id,
          originalName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          storageKey,
        },
      });
      savedAttachments.push(row);
    }

    return { ...created, attachments: savedAttachments };
  });

  if (isStaff && !req.firstResponseAt) {
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        firstResponseAt: new Date(),
        assignedManagerId: req.assignedManagerId || user.id,
      },
    });
  }

  if (isStaff && req.clientId) {
    await notifyManagerMessage({
      clientId: req.clientId,
      requestId,
      messageId: msg.id,
      preview: text,
    });
  }

  return {
    ...msg,
    attachments: msg.attachments.map((a) => serializeAttachment(a, requestId)),
    deliveryStatus: resolveDeliveryStatus(msg, user, peerReadAtFor(user, req)),
  };
}

export async function getAttachment(requestId, messageId, attachmentId, user) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (user.role === 'CLIENT' && req.clientId !== user.id) {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  if (!['CLIENT', 'MANAGER', 'ADMINISTRATOR'].includes(user.role)) {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }

  const attachment = await prisma.requestFollowUpAttachment.findFirst({
    where: { id: attachmentId, messageId, message: { requestId } },
  });
  if (!attachment) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const buffer = await readAttachmentFile(attachment.storageKey);
  return {
    buffer,
    mimeType: attachment.mimeType,
    fileName: attachment.originalName,
  };
}
