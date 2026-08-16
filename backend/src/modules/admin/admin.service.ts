import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import * as referenceService from '../reference/reference.service.js';
import * as securityService from '../users/security.service.js';

const LAST_ADMIN_MESSAGE = 'Нельзя лишить доступа последнего администратора';

async function assertKeepsActiveAdmin(userId, { nextRole, nextBlocked }: any = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Пользователь не найден', 'NOT_FOUND');
  const isActiveAdmin = user.role === 'ADMINISTRATOR' && !user.blocked;
  if (!isActiveAdmin) return user;
  const wouldLoseAdmin = (nextRole && nextRole !== 'ADMINISTRATOR') || nextBlocked === true;
  if (!wouldLoseAdmin) return user;
  const others = await prisma.user.count({
    where: { role: 'ADMINISTRATOR', blocked: false, id: { not: userId } },
  });
  if (others === 0) throw new AppError(409, LAST_ADMIN_MESSAGE, 'LAST_ADMIN');
  return user;
}

export async function listUsers({ limit = 100, offset = 0, q, role, blocked }: any = {}) {
  const where: any = {};
  if (role) where.role = role;
  if (blocked === true || blocked === false) where.blocked = blocked;
  const query = String(q || '').trim();
  if (query) {
    where.OR = [
      { email: { contains: query, mode: 'insensitive' } },
      { fullName: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query } },
    ];
  }
  return prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    skip: offset,
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      blocked: true,
      createdAt: true,
    },
  });
}

export async function patchUserRole(userId, role, actorId) {
  const prev = await assertKeepsActiveAdmin(userId, { nextRole: role });
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role, tokenVersion: { increment: 1 } },
    select: { id: true, email: true, role: true, blocked: true },
  });
  invalidateAuthUserCache(userId);
  await writeAdminAudit(actorId, 'USER_ROLE_UPDATE', 'user', userId, {
    from: prev.role,
    to: role,
    email: prev.email,
  });
  return updated;
}

export async function blockUser(userId, actorId) {
  const prev = await assertKeepsActiveAdmin(userId, { nextBlocked: true });
  await prisma.user.update({
    where: { id: userId },
    data: { blocked: true, tokenVersion: { increment: 1 } },
  });
  await prisma.refreshToken.deleteMany({ where: { userId } });
  invalidateAuthUserCache(userId);
  await writeAdminAudit(actorId, 'USER_BLOCKED', 'user', userId, { email: prev.email, role: prev.role });
}

export async function unblockUser(userId, actorId) {
  const prev = await prisma.user.findUnique({ where: { id: userId } });
  if (!prev) throw new AppError(404, 'Пользователь не найден', 'NOT_FOUND');
  await prisma.user.update({
    where: { id: userId },
    data: { blocked: false },
  });
  invalidateAuthUserCache(userId);
  await writeAdminAudit(actorId, 'USER_UNBLOCKED', 'user', userId, { email: prev.email, role: prev.role });
}

export async function listAdminSessions(currentRefreshToken) {
  return securityService.listAllActiveSessions(currentRefreshToken);
}

export async function revokeAdminSession(sessionId, actorId) {
  const out = await securityService.revokeAnySession(sessionId);
  await writeAdminAudit(actorId, 'SESSION_REVOKE', 'user', out.userId, { sessionId });
  return out;
}

export async function revokeAdminUserSessions(userId, actorId) {
  const out = await securityService.revokeAllUserSessions(userId);
  await writeAdminAudit(actorId, 'SESSION_REVOKE_ALL', 'user', userId, { revoked: out.revoked });
  return out;
}

export async function listContentBlocks({ section }: any = {}) {
  return prisma.siteContentBlock.findMany({
    where: section ? { section } : undefined,
    orderBy: [{ section: 'asc' }, { updatedAt: 'desc' }],
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      },
    },
  });
}

export async function createContentBlock(actorId, { key, title, section, content }: any) {
  const cleanKey = String(key || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._-]{3,100}$/.test(cleanKey)) {
    throw new AppError(400, 'Ключ блока должен содержать 3-100 символов: a-z, 0-9, ., _, -', 'BAD_REQUEST');
  }
  const row = await prisma.siteContentBlock.create({
    data: {
      key: cleanKey,
      title: String(title || '').trim(),
      section: String(section || 'general').trim() || 'general',
      content: String(content || '').trim(),
      isPublished: false,
      versions: {
        create: {
          content: String(content || '').trim(),
          note: 'Первичная версия',
          createdBy: actorId || null,
        },
      },
    },
    include: { versions: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  await writeAdminAudit(actorId, 'CMS_BLOCK_CREATE', 'site_content_block', row.id, {
    key: row.key,
    section: row.section,
  });
  return row;
}

export async function patchContentBlock(blockId, actorId, data) {
  const prev = await prisma.siteContentBlock.findUnique({ where: { id: blockId } });
  if (!prev) throw new AppError(404, 'Блок контента не найден', 'NOT_FOUND');
  const payload: any = {};
  if (data.title !== undefined) payload.title = String(data.title || '').trim();
  if (data.section !== undefined) payload.section = String(data.section || '').trim() || 'general';
  if (data.isPublished !== undefined) payload.isPublished = Boolean(data.isPublished);
  if (data.content !== undefined) {
    payload.content = String(data.content || '').trim();
  }
  const changedContent = payload.content !== undefined && payload.content !== prev.content;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.siteContentBlock.update({
      where: { id: blockId },
      data: payload,
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { actor: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
    if (changedContent) {
      await tx.siteContentVersion.create({
        data: {
          blockId,
          content: payload.content,
          note: data.note ? String(data.note).slice(0, 240) : 'Редактирование в панели',
          createdBy: actorId || null,
        },
      });
    }
    await tx.adminAuditEvent.create({
      data: {
        actorId: actorId || null,
        action: 'CMS_BLOCK_UPDATE',
        entityType: 'site_content_block',
        entityId: blockId,
        payloadJson: {
          title: payload.title,
          section: payload.section,
          isPublished: payload.isPublished,
          changedContent,
        },
      },
    });
    return updated;
  });
}

export async function rollbackContentBlock(blockId, versionId, actorId) {
  const v = await prisma.siteContentVersion.findFirst({
    where: { id: versionId, blockId },
  });
  if (!v) throw new AppError(404, 'Версия не найдена', 'NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    await tx.siteContentBlock.update({
      where: { id: blockId },
      data: { content: v.content },
    });
    await tx.siteContentVersion.create({
      data: {
        blockId,
        content: v.content,
        note: `Откат к версии ${versionId.slice(0, 8)}`,
        createdBy: actorId || null,
      },
    });
    await tx.adminAuditEvent.create({
      data: {
        actorId: actorId || null,
        action: 'CMS_BLOCK_ROLLBACK',
        entityType: 'site_content_block',
        entityId: blockId,
        payloadJson: { versionId },
      },
    });
    return tx.siteContentBlock.findUnique({
      where: { id: blockId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { actor: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
  });
}

export async function listAdminAuditEvents({ action, entityType, actorId, from, to, limit = 100 }: any = {}) {
  const createdAt: any = {};
  if (from) createdAt.gte = new Date(from);
  if (to) createdAt.lte = new Date(to);
  return prisma.adminAuditEvent.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actorId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, Math.max(1, Number(limit) || 100)),
    include: {
      actor: { select: { id: true, fullName: true, email: true } },
    },
  });
}

async function writeAdminAudit(actorId, action, entityType, entityId, payloadJson) {
  await prisma.adminAuditEvent.create({
    data: { actorId: actorId || null, action, entityType, entityId, payloadJson },
  });
}

const CMS_KIND_PREFIX = {
  service: '[CMS_SERVICE]',
  work: '[CMS_WORK]',
  gallery: '[CMS_GALLERY]',
};

function parseCmsMaterial(row) {
  const title = String(row.title || '');
  const kind = Object.entries(CMS_KIND_PREFIX).find(([, p]) => title.startsWith(p))?.[0];
  if (!kind) return null;
  let payload: any = {};
  try {
    payload = JSON.parse(String(row.body || '{}'));
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    kind,
    title: payload.title || title.replace(/^\[[A-Z_]+\]\s*/, ''),
    description: payload.description || '',
    price: payload.price || '',
    category: payload.category || '',
    imageUrl: payload.imageUrl || '',
    problem: payload.problem || '',
    result: payload.result || '',
    term: payload.term || '',
    published: payload.published !== false,
    orderIndex: Number.isFinite(Number(payload.orderIndex)) ? Number(payload.orderIndex) : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCmsStorage(kind, payload) {
  const prefix = CMS_KIND_PREFIX[kind];
  if (!prefix) throw new AppError(400, 'Некорректный тип CMS-записи', 'BAD_REQUEST');
  const title = `${prefix} ${String(payload.title || '').trim()}`.trim();
  const body = JSON.stringify({
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    price: String(payload.price || '').trim(),
    category: String(payload.category || '').trim(),
    imageUrl: String(payload.imageUrl || '').trim(),
    problem: String(payload.problem || '').trim(),
    result: String(payload.result || '').trim(),
    term: String(payload.term || '').trim(),
    published: payload.published !== false,
    orderIndex: Number.isFinite(Number(payload.orderIndex)) ? Number(payload.orderIndex) : 0,
  });
  return { title, body };
}

export async function listCmsSiteItems({ kind, publishedOnly = false }: any = {}) {
  const rows = await referenceService.listReferenceMaterials();
  const cms = rows
    .map(parseCmsMaterial)
    .filter(Boolean)
    .filter((x) => (kind ? x.kind === kind : true))
    .filter((x) => (publishedOnly ? x.published : true))
    .sort((a, b) => {
      if (a.kind !== b.kind) return String(a.kind).localeCompare(String(b.kind), 'ru');
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  return cms;
}

export async function createCmsSiteItem(actorId, { kind, ...payload }: any) {
  if (!String(payload.title || '').trim()) {
    throw new AppError(400, 'Заголовок обязателен', 'BAD_REQUEST');
  }
  const allKindRows = await listCmsSiteItems({ kind });
  const nextOrder = allKindRows.length ? Math.max(...allKindRows.map((x) => x.orderIndex || 0)) + 1 : 1;
  const storage = toCmsStorage(kind, { ...payload, orderIndex: nextOrder, published: true });
  const row = await referenceService.createReferenceMaterial({
    title: storage.title,
    body: storage.body,
    categoryId: null,
  });
  await writeAdminAudit(actorId, 'CMS_SITE_ITEM_CREATE', 'site_item', row.id, { kind, title: payload.title });
  return parseCmsMaterial(row);
}

export async function updateCmsSiteItem(itemId, actorId, { kind, ...payload }: any) {
  const current = await prisma.referenceMaterial.findUnique({ where: { id: itemId } });
  if (!current) throw new AppError(404, 'Запись не найдена', 'NOT_FOUND');
  const currentKind = parseCmsMaterial(current)?.kind || kind;
  const currentPayload: any = parseCmsMaterial(current) || {};
  const storage = toCmsStorage(currentKind, {
    ...currentPayload,
    ...payload,
    published: payload.published ?? currentPayload.published ?? true,
    orderIndex: payload.orderIndex ?? currentPayload.orderIndex ?? 0,
  });
  const row = await referenceService.updateReferenceMaterial(itemId, {
    title: storage.title,
    body: storage.body,
    categoryId: null,
  });
  await writeAdminAudit(actorId, 'CMS_SITE_ITEM_UPDATE', 'site_item', itemId, { kind: currentKind, title: payload.title });
  return parseCmsMaterial(row);
}

export async function deleteCmsSiteItem(itemId, actorId) {
  const current = await prisma.referenceMaterial.findUnique({ where: { id: itemId } });
  if (!current) throw new AppError(404, 'Запись не найдена', 'NOT_FOUND');
  const parsed = parseCmsMaterial(current);
  if (!parsed) throw new AppError(409, 'Это не CMS-запись сайта', 'CONFLICT');
  await referenceService.deleteReferenceMaterial(itemId);
  await writeAdminAudit(actorId, 'CMS_SITE_ITEM_DELETE', 'site_item', itemId, { kind: parsed.kind, title: parsed.title });
}

export async function reorderCmsSiteItems(actorId, kind, ids) {
  const rows = await listCmsSiteItems({ kind });
  const map = new Map(rows.map((r) => [r.id, r]));
  const cleanIds = Array.from(new Set((ids || []).map((x) => String(x))));
  if (!cleanIds.length) throw new AppError(400, 'Пустой список сортировки', 'BAD_REQUEST');
  const updates = cleanIds
    .map((id, idx) => ({ id, row: map.get(id), orderIndex: idx + 1 }))
    .filter((x) => x.row);
  await prisma.$transaction(
    updates.map((u: any) => {
      const storage = toCmsStorage(kind, {
        ...u.row,
        orderIndex: u.orderIndex,
        published: u.row.published,
      });
      return referenceService.updateReferenceMaterial(u.id, {
        title: storage.title,
        body: storage.body,
        categoryId: null,
      });
    }) as any,
  );
  await writeAdminAudit(actorId, 'CMS_SITE_ITEM_REORDER', 'site_item', null, { kind, ids: cleanIds });
  return listCmsSiteItems({ kind });
}
