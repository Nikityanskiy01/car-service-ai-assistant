import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import * as referenceService from '../reference/reference.service.js';
import { writeAdminAudit } from './admin.audit.js';

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
