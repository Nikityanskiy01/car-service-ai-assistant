import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../../contact/contact.service.js';
import { listVehiclesForDossier } from '../../vehicles/vehicles.service.js';

const ACTIVE_STATUSES = ['NEW', 'IN_PROGRESS', 'SCHEDULED'];

function assertStaff(user) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
}

export async function listClients(
  user,
  { q = '', filter = 'all', sort = 'activity', page = 1, pageSize = 20 }: any = {},
) {
  assertStaff(user);
  const take = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const pageNum = Math.max(1, Number(page) || 1);
  const query = String(q || '').trim().toLowerCase();

  const [users, clientTotals, clientActive, guestRows] = (await Promise.all([
    prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { id: true, fullName: true, phone: true, email: true, telegram: true },
    }),
    (prisma.serviceRequest as any).groupBy({
      by: ['clientId'],
      where: { clientId: { not: null } },
      _count: { id: true },
      _max: { createdAt: true },
    }),
    (prisma.serviceRequest as any).groupBy({
      by: ['clientId'],
      where: { clientId: { not: null }, status: { in: ACTIVE_STATUSES } },
      _count: { id: true },
    }),
    prisma.serviceRequest.findMany({
      where: { clientId: null, guestPhone: { not: null } },
      select: { guestPhone: true, guestName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])) as any;

  const totalsByClient = new Map(clientTotals.map((row) => [row.clientId, row]));
  const activeByClient = new Map(clientActive.map((row) => [row.clientId, row._count.id]));
  const items = [];

  for (const profile of users) {
    const totals = totalsByClient.get(profile.id);
    items.push({
      key: profile.id,
      clientId: profile.id,
      name: profile.fullName,
      phone: profile.phone || '',
      email: profile.email || '',
      telegram: profile.telegram || '',
      isGuest: false,
      totalRequests: (totals as any)?._count?.id || 0,
      activeRequests: activeByClient.get(profile.id) || 0,
      lastActivityAt: (totals as any)?._max?.createdAt ? (totals as any)._max.createdAt.toISOString() : null,
    });
  }

  const guests = new Map();
  for (const row of guestRows) {
    const phone = row.guestPhone;
    if (!phone) continue;
    const existing = guests.get(phone);
    if (existing) {
      existing.totalRequests += 1;
      if (ACTIVE_STATUSES.includes(row.status)) existing.activeRequests += 1;
      continue;
    }
    guests.set(phone, {
      key: `guest:${phone}`,
      guestPhone: phone,
      name: row.guestName || 'Гость',
      phone,
      email: '',
      telegram: '',
      isGuest: true,
      totalRequests: 1,
      activeRequests: ACTIVE_STATUSES.includes(row.status) ? 1 : 0,
      lastActivityAt: row.createdAt.toISOString(),
    });
  }
  items.push(...guests.values());

  let filtered = items;
  if (filter === 'active') filtered = filtered.filter((item) => item.activeRequests > 0);
  if (filter === 'guests') filtered = filtered.filter((item) => item.isGuest);
  if (query) {
    filtered = filtered.filter((item) => {
      const haystack = `${item.name} ${item.phone} ${item.email} ${item.telegram}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
    if (sort === 'recent') {
      return String(b.lastActivityAt || '').localeCompare(String(a.lastActivityAt || ''));
    }
    return b.activeRequests - a.activeRequests || a.name.localeCompare(b.name, 'ru');
  });

  const total = filtered.length;
  const start = (pageNum - 1) * take;
  return { items: filtered.slice(start, start + take), total, page: pageNum, pageSize: take };
}

export async function getClientDossier(user, clientId) {
  assertStaff(user);
  const profile = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, fullName: true, email: true, phone: true, telegram: true, role: true, createdAt: true },
  });
  if (!profile) throw new AppError(404, 'Клиент не найден', 'NOT_FOUND');
  const [requests, bookings, consultations, feedbackAgg] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, status: true, createdAt: true, snapshotMake: true, snapshotModel: true },
    }),
    prisma.serviceBooking.findMany({
      where: { clientId },
      orderBy: { preferredAt: 'desc' },
      take: 30,
      select: { id: true, status: true, preferredAt: true, notes: true },
    }),
    prisma.consultationSession.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, status: true, createdAt: true, updatedAt: true, progressPercent: true },
    }),
    prisma.consultationFeedback.aggregate({
      where: {
        repairAmountMinor: { not: null },
        session: { serviceRequest: { clientId } },
      },
      _sum: { repairAmountMinor: true },
      _count: { id: true },
    }),
  ]);
  const completedRequests = requests.filter((r) => r.status === 'COMPLETED').length;
  const metrics = {
    requestsTotal: requests.length,
    completedRequests,
    ltvMinor: feedbackAgg._sum.repairAmountMinor || 0,
    repairsWithAmount: feedbackAgg._count.id || 0,
  };
  return { profile, requests, bookings, consultations, metrics, vehicles: await listVehiclesForDossier(clientId) };
}

export async function getGuestDossier(user, phoneRaw) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const phone = normalizePhone(phoneRaw);
  if (!isValidPhoneDigits(phone)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  const [requests, bookings, contacts, feedbackAgg] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { guestPhone: phone },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        createdAt: true,
        snapshotMake: true,
        snapshotModel: true,
        guestName: true,
        snapshotSymptoms: true,
      },
    }),
    prisma.serviceBooking.findMany({
      where: { guestPhone: phone },
      orderBy: { preferredAt: 'desc' },
      take: 30,
      select: { id: true, status: true, preferredAt: true, notes: true, guestName: true },
    }),
    prisma.contactSubmission.findMany({
      where: { phone },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, fullName: true, message: true, status: true, createdAt: true },
    }),
    prisma.consultationFeedback.aggregate({
      where: {
        repairAmountMinor: { not: null },
        session: { serviceRequest: { guestPhone: phone } },
      },
      _sum: { repairAmountMinor: true },
      _count: { id: true },
    }),
  ]);

  const profile = {
    phone,
    fullName: requests[0]?.guestName || bookings[0]?.guestName || contacts[0]?.fullName || 'Гость',
    isGuest: true,
  };

  const completedRequests = requests.filter((r) => r.status === 'COMPLETED').length;
  const metrics = {
    requestsTotal: requests.length,
    completedRequests,
    ltvMinor: feedbackAgg._sum.repairAmountMinor || 0,
    repairsWithAmount: feedbackAgg._count.id || 0,
  };

  return { profile, requests, bookings, contacts, metrics };
}
