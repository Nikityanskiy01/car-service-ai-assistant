import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { getUrgencyFromRequest } from '../../../lib/requestDiagnosis.js';
import { SLA_MS } from '../../../lib/requestSla.js';
import { decodeCursor, nextCursorFromPage } from '../../../lib/cursorPage.js';

function periodSince(period) {
  if (!period || period === 'all') return null;
  const since = new Date();
  if (period === 'today') {
    since.setHours(0, 0, 0, 0);
    return since;
  }
  if (period === '7d') {
    since.setDate(since.getDate() - 7);
    return since;
  }
  return null;
}

function hasDiagnosisInRow(row) {
  const flowState = row?.consultationSession?.flowState;
  if (!flowState || typeof flowState !== 'object' || Array.isArray(flowState)) return false;
  return Boolean(flowState.diagnosis);
}

export async function listRequests(
  user,
  {
    status,
    q,
    page = 1,
    pageSize = 20,
    sort = 'createdAt',
    dir = 'desc',
    mine,
    sla,
    feedback,
    urgency,
    statuses,
    source,
    period,
    hasDiagnosis,
    cursor,
  }: any = {},
) {
  if (user.role !== 'CLIENT' && user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const where: any = {};
  if (user.role === 'CLIENT') {
    where.clientId = user.id;
  }
  if (status) where.status = status;
  if (statuses?.length) {
    where.status = { in: statuses };
  }
  if (source === 'guest') {
    where.clientId = null;
  } else if (source === 'registered') {
    where.clientId = { not: null };
  } else if (source === 'contact') {
    const converted = await prisma.contactSubmission.findMany({
      where: { convertedRequestId: { not: null } },
      select: { convertedRequestId: true },
      take: 500,
    });
    const ids = converted.map((c) => c.convertedRequestId).filter(Boolean);
    where.id = ids.length ? { in: ids } : { in: ['00000000-0000-0000-0000-000000000000'] };
  }
  const since = periodSince(period);
  if (since) {
    where.createdAt = { ...(where.createdAt || {}), gte: since };
  }
  if (mine === true || mine === 'true' || mine === '1') {
    where.assignedManagerId = user.id;
  }
  const take = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const pageNum = Math.max(1, Number(page) || 1);

  if (sla === 'breached') {
    const threshold = new Date(Date.now() - SLA_MS);
    const slaStatuses = ['NEW', 'IN_PROGRESS'];
    where.firstResponseAt = null;
    where.createdAt = { ...(where.createdAt || {}), lt: threshold };
    const current = where.status;
    if (typeof current === 'string') {
      if (!slaStatuses.includes(current)) {
        return { items: [], total: 0, page: pageNum, pageSize: take, nextCursor: null };
      }
    } else if (current?.in) {
      const next = current.in.filter((s) => slaStatuses.includes(s));
      if (!next.length) {
        return { items: [], total: 0, page: pageNum, pageSize: take, nextCursor: null };
      }
      where.status = { in: next };
    } else {
      where.status = { in: slaStatuses };
    }
  }
  if (feedback === 'none') {
    where.consultationSession = { feedback: { is: null } };
  } else if (feedback && ['CORRECT', 'PARTIAL', 'INCORRECT'].includes(String(feedback).toUpperCase())) {
    where.consultationSession = { feedback: { verdict: String(feedback).toUpperCase() } };
  }
  if (q && String(q).trim()) {
    const s = String(q).trim();
    where.OR = [
      { snapshotMake: { contains: s, mode: 'insensitive' } },
      { snapshotModel: { contains: s, mode: 'insensitive' } },
      { snapshotSymptoms: { contains: s, mode: 'insensitive' } },
      { guestName: { contains: s, mode: 'insensitive' } },
      { guestPhone: { contains: s, mode: 'insensitive' } },
      { client: { fullName: { contains: s, mode: 'insensitive' } } },
    ];
  }
  const searchActive = Boolean(q && String(q).trim());
  const orderDir = dir === 'asc' ? 'asc' : 'desc';
  const useCreatedAtCursor = !searchActive && (sort === 'createdAt' || !sort);
  const decodedCursor = useCreatedAtCursor ? decodeCursor(cursor) : null;
  if (decodedCursor) {
    const createdOp = orderDir === 'asc' ? 'gt' : 'lt';
    const idOp = orderDir === 'asc' ? 'gt' : 'lt';
    where.AND = [
      ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
      {
        OR: [
          { createdAt: { [createdOp]: new Date(decodedCursor.t) } },
          { createdAt: new Date(decodedCursor.t), id: { [idOp]: decodedCursor.id } },
        ],
      },
    ];
  }
  const skip = decodedCursor ? 0 : (pageNum - 1) * take;
  let orderBy;
  switch (sort) {
    case 'status':
      orderBy = { status: orderDir };
      break;
    case 'version':
      orderBy = { version: orderDir };
      break;
    case 'client':
      orderBy = [{ client: { fullName: orderDir } }, { guestName: orderDir }];
      break;
    case 'car':
      orderBy = [{ snapshotMake: orderDir }, { snapshotModel: orderDir }];
      break;
    case 'createdAt':
    default:
      orderBy = { createdAt: orderDir };
      break;
  }
  const include: any = {
    client: { select: { id: true, fullName: true, phone: true, email: true } },
    assignedManager: { select: { id: true, fullName: true } },
  };
  if (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR' || user.role === 'CLIENT') {
    include.consultationSession = {
      select: {
        id: true,
        status: true,
        feedback: { select: { id: true, verdict: true } },
        flowState: true,
        confidencePercent: true,
        serviceCategory: { select: { name: true } },
      },
    };
  }

  const urgencyFilter = urgency ? String(urgency).toLowerCase() : null;
  const diagnosisFilter =
    hasDiagnosis === true || hasDiagnosis === 'true' || hasDiagnosis === '1'
      ? 'yes'
      : hasDiagnosis === false || hasDiagnosis === 'false' || hasDiagnosis === '0'
        ? 'no'
        : null;
  const needsPostFilter = Boolean(urgencyFilter || diagnosisFilter);
  const fetchTake = needsPostFilter ? Math.min(take * 5, 200) : take;
  const fetchSkip = needsPostFilter ? 0 : skip;

  let items = await prisma.serviceRequest.findMany({
    where,
    orderBy,
    take: fetchTake,
    skip: fetchSkip,
    include,
  });

  if (urgencyFilter) {
    items = items.filter((row) => getUrgencyFromRequest(row) === urgencyFilter);
  }
  if (diagnosisFilter === 'yes') {
    items = items.filter((row) => hasDiagnosisInRow(row));
  } else if (diagnosisFilter === 'no') {
    items = items.filter((row) => !hasDiagnosisInRow(row));
  }
  if (needsPostFilter) {
    const totalFiltered = items.length;
    items = items.slice(skip, skip + take);
    return { items, total: totalFiltered, page: pageNum, pageSize: take, nextCursor: null };
  }

  const total = await prisma.serviceRequest.count({ where });
  const nextCursor = useCreatedAtCursor
    ? nextCursorFromPage(items, {
        limit: take,
        getCursor: (row) => ({ id: row.id, t: row.createdAt.toISOString() }),
      })
    : null;
  return { items, total, page: pageNum, pageSize: take, nextCursor };
}

const BOARD_STATUSES = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

export async function listBoard(user, params: any = {}) {
  const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 20), 50);
  let statuses = Array.isArray(params.statuses) && params.statuses.length
    ? params.statuses.filter((status) => BOARD_STATUSES.includes(status))
    : [...BOARD_STATUSES];
  if (params.status && BOARD_STATUSES.includes(params.status) && !(params.statuses && params.statuses.length)) {
    statuses = [params.status];
  }
  if (params.sla === 'breached') {
    statuses = statuses.filter((status) => status === 'NEW' || status === 'IN_PROGRESS');
    if (!statuses.length) statuses = ['NEW', 'IN_PROGRESS'];
  }

  const columns: any = {};
  let total = 0;
  await Promise.all(
    statuses.map(async (status) => {
      const out = await listRequests(user, {
        ...params,
        status,
        statuses: undefined,
        page: 1,
        pageSize,
      });
      columns[status] = {
        items: out.items,
        total: out.total,
        page: 1,
        pageSize: out.pageSize,
      };
      total += out.total;
    }),
  );
  return { columns, total };
}
