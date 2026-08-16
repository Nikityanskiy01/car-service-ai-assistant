import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { exportRequestToConnection } from '../../integrations/integrations.service.js';

export async function listActivity(user, { limit = 15 }: any = {}) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const take = Math.min(Math.max(1, Number(limit) || 15), 50);

  const [requests, messages, feedbacks, contacts, crmJobs] = await Promise.all([
    prisma.serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        guestName: true,
        snapshotMake: true,
        snapshotModel: true,
        client: { select: { fullName: true } },
      },
    }),
    prisma.requestFollowUpMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        request: { select: { id: true } },
        author: { select: { fullName: true } },
      },
    }),
    prisma.consultationFeedback.findMany({
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        session: { select: { serviceRequest: { select: { id: true } } } },
        manager: { select: { fullName: true } },
      },
    }),
    prisma.contactSubmission.findMany({
      where: { status: 'CONVERTED', convertedRequestId: { not: null } },
      orderBy: { processedAt: 'desc' },
      take,
      select: { id: true, fullName: true, convertedRequestId: true, processedAt: true },
    }),
    prisma.integrationJob.findMany({
      where: {
        status: { in: ['SUCCEEDED', 'FAILED', 'DEAD_LETTER'] },
        entityType: 'service_request',
      },
      orderBy: { updatedAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        entityId: true,
        connection: { select: { name: true } },
      },
    }),
  ]);

  const items = [];
  for (const r of requests) {
    const name = r.client?.fullName || r.guestName || 'Клиент';
    const car = [r.snapshotMake, r.snapshotModel].filter(Boolean).join(' ');
    items.push({
      id: `req-${r.id}`,
      type: 'REQUEST_CREATED',
      at: r.createdAt.toISOString(),
      title: `Новая заявка: ${name}${car ? ` · ${car}` : ''}`,
      requestId: r.id,
    });
  }
  for (const m of messages) {
    items.push({
      id: `msg-${m.id}`,
      type: 'MESSAGE_SENT',
      at: m.createdAt.toISOString(),
      title: `Сообщение клиенту · ${m.author?.fullName || 'Менеджер'}`,
      requestId: m.request?.id,
    });
  }
  for (const f of feedbacks) {
    const requestId = f.session?.serviceRequest?.id;
    items.push({
      id: `fb-${f.id}`,
      type: 'FEEDBACK_SAVED',
      at: f.updatedAt.toISOString(),
      title: `Оценка ИИ: ${f.verdict} · ${f.manager?.fullName || 'Менеджер'}`,
      requestId,
    });
  }
  for (const c of contacts) {
    items.push({
      id: `contact-${c.id}`,
      type: 'CONTACT_CONVERTED',
      at: (c.processedAt || new Date()).toISOString(),
      title: `Входящее → заявка: ${c.fullName}`,
      requestId: c.convertedRequestId,
    });
  }
  for (const job of crmJobs) {
    if (!job.entityId) continue;
    const failed = ['FAILED', 'DEAD_LETTER'].includes(job.status);
    items.push({
      id: `crm-${job.id}`,
      type: failed ? 'CRM_FAILED' : 'CRM_EXPORTED',
      at: job.updatedAt.toISOString(),
      title: failed
        ? `Ошибка CRM (${job.connection?.name || 'интеграция'})`
        : `Экспорт в CRM (${job.connection?.name || 'интеграция'})`,
      requestId: job.entityId,
    });
  }

  return {
    items: items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, take),
  };
}

export async function bulkExportToCrm(user, { ids, connectionId }: any) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const uniqueIds = Array.from(new Set((ids || []).map((v) => String(v))));
  if (!uniqueIds.length) throw new AppError(400, 'Нужно передать список заявок', 'BAD_REQUEST');

  let connId = connectionId;
  if (!connId) {
    const conn = await prisma.integrationConnection.findFirst({
      where: { enabled: true, status: 'CONNECTED' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conn) throw new AppError(400, 'Нет активного подключения CRM', 'BAD_REQUEST');
    connId = conn.id;
  }

  let exported = 0;
  const errors = [];
  for (const id of uniqueIds) {
    try {
      await exportRequestToConnection(id, connId);
      exported += 1;
    } catch (err) {
      errors.push({ id, message: err?.message || 'Не удалось выгрузить заявку.' });
    }
  }
  return { exported, failed: errors.length, errors: errors.slice(0, 5) };
}
