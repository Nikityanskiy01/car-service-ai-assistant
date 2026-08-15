import { randomUUID } from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  MAX_COMPLETION_DOCUMENTS,
  readCompletionDocumentFile,
  saveCompletionDocumentFile,
  serializeCompletionDocument,
  validateCompletionDocumentInput,
} from '../../lib/completionDocumentStorage.js';
import { notifyClientSafe } from '../notifications/clientNotify.service.js';

async function assertRequestAccess(requestId, user) {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, clientId: true, status: true, snapshotMake: true, snapshotModel: true },
  });
  if (!req) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (user.role === 'CLIENT' && req.clientId !== user.id) {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  if (user.role !== 'CLIENT' && user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  return req;
}

export async function listCompletionDocuments(requestId, user) {
  await assertRequestAccess(requestId, user);
  const rows = await prisma.serviceRequestCompletionDocument.findMany({
    where: { requestId },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
  });
  return rows.map((row) => serializeCompletionDocument(row, requestId));
}

export async function uploadCompletionDocument(requestId, user, input) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const req = await assertRequestAccess(requestId, user);
  const parsed = validateCompletionDocumentInput(input);

  const count = await prisma.serviceRequestCompletionDocument.count({ where: { requestId } });
  if (count >= MAX_COMPLETION_DOCUMENTS) {
    throw new AppError(400, `Не больше ${MAX_COMPLETION_DOCUMENTS} документов на заявку`, 'BAD_REQUEST');
  }

  const id = randomUUID();
  const storageKey = await saveCompletionDocumentFile(parsed.buffer, id);

  const row = await prisma.serviceRequestCompletionDocument.create({
    data: {
      id,
      requestId,
      kind: parsed.kind,
      label: parsed.label,
      originalName: parsed.fileName,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      storageKey,
      uploadedById: user.id,
    },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
  });

  if (req.clientId && req.status === 'COMPLETED') {
    const car = [req.snapshotMake, req.snapshotModel].filter(Boolean).join(' ') || 'авто';
    await notifyClientSafe(req.clientId, {
      kind: 'COMPLETION_DOCUMENTS',
      title: 'Документы по ремонту',
      body: `${parsed.kind === 'WORK_ORDER' ? 'Заказ-наряд' : 'Документ'} добавлен в кабинет (${car}).`,
      href: `/dashboard/client/cases/${requestId}?tab=progress`,
      dedupeKey: `completion-doc:${row.id}`,
    });
  }

  return serializeCompletionDocument(row, requestId);
}

export async function getCompletionDocumentFile(requestId, documentId, user) {
  await assertRequestAccess(requestId, user);
  const row = await prisma.serviceRequestCompletionDocument.findFirst({
    where: { id: documentId, requestId },
  });
  if (!row) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const buffer = await readCompletionDocumentFile(row.storageKey);
  return {
    buffer,
    mimeType: row.mimeType,
    fileName: row.originalName,
  };
}

export async function deleteCompletionDocument(requestId, documentId, user) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  await assertRequestAccess(requestId, user);
  const row = await prisma.serviceRequestCompletionDocument.findFirst({
    where: { id: documentId, requestId },
  });
  if (!row) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  await prisma.serviceRequestCompletionDocument.delete({ where: { id: row.id } });
  return { ok: true };
}
