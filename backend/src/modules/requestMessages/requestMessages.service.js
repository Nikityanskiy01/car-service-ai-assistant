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

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);

async function mapMessagesWithAttachments(messages, requestId) {
  return messages.map((m) => ({
    ...m,
    attachments: (m.attachments || []).map((a) => serializeAttachment(a, requestId)),
  }));
}

export async function listMessages(requestId, user) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (user.role === 'CLIENT' && req.clientId !== user.id) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
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
    }
    return mapMessagesWithAttachments(messages, requestId);
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function countUnreadMessagesForClient(userId) {
  const requests = await prisma.serviceRequest.findMany({
    where: { clientId: userId },
    select: { id: true, clientMessagesReadAt: true },
  });
  if (!requests.length) return 0;

  let total = 0;
  for (const req of requests) {
    const count = await prisma.requestFollowUpMessage.count({
      where: {
        requestId: req.id,
        author: { role: { not: 'CLIENT' } },
        ...(req.clientMessagesReadAt ? { createdAt: { gt: req.clientMessagesReadAt } } : {}),
      },
    });
    total += count;
  }
  return total;
}

export async function postMessage(requestId, user, { body = '', attachments = [] } = {}) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (CLOSED.has(req.status)) {
    throw new AppError(409, 'Thread is read-only for this status', 'THREAD_LOCKED');
  }

  const isClient = user.role === 'CLIENT' && req.clientId === user.id;
  const isStaff = user.role === 'MANAGER' || user.role === 'ADMINISTRATOR';
  if (!isClient && !isStaff) throw new AppError(403, 'Forbidden', 'FORBIDDEN');

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

  return {
    ...msg,
    attachments: msg.attachments.map((a) => serializeAttachment(a, requestId)),
  };
}

export async function getAttachment(requestId, messageId, attachmentId, user) {
  const req = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (user.role === 'CLIENT' && req.clientId !== user.id) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  if (!['CLIENT', 'MANAGER', 'ADMINISTRATOR'].includes(user.role)) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  const attachment = await prisma.requestFollowUpAttachment.findFirst({
    where: { id: attachmentId, messageId, message: { requestId } },
  });
  if (!attachment) throw new AppError(404, 'Not found', 'NOT_FOUND');

  const buffer = await readAttachmentFile(attachment.storageKey);
  return {
    buffer,
    mimeType: attachment.mimeType,
    fileName: attachment.originalName,
  };
}
