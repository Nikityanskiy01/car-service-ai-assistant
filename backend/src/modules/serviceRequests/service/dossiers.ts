import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../../contact/contact.service.js';
import { listVehiclesForDossier } from '../../vehicles/vehicles.service.js';
import {
  ACTIVE_STATUSES,
  UPCOMING_BOOKING,
  assertStaff,
  iso,
  ltvBucket,
  nextBookingAt,
  pushUniqueVehicle,
  snapshotVehiclesFromRequests,
  stripVehicleKeys,
  vehicleHaystack,
} from './dossiers.helpers.js';

export async function listClients(
  user,
  { q = '', filter = 'all', sort = 'activity', page = 1, pageSize = 20 } = {},
) {
  assertStaff(user);
  const take = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  const pageNum = Math.max(1, Number(page) || 1);
  const query = String(q || '').trim().toLowerCase();

  const groupByRequests = (prisma as { serviceRequest: { groupBy: (args: Record<string, unknown>) => Promise<unknown> } })
    .serviceRequest.groupBy;
  const clientTotals = (await groupByRequests({
    by: ['clientId'],
    where: { clientId: { not: null } },
    _count: { id: true },
    _max: { createdAt: true },
  })) as Array<{ clientId: string | null; _count: { id: number }; _max: { createdAt: Date | null } }>;
  const clientActive = (await groupByRequests({
    by: ['clientId'],
    where: { clientId: { not: null }, status: { in: ACTIVE_STATUSES } },
    _count: { id: true },
  })) as Array<{ clientId: string | null; _count: { id: number } }>;

  const [users, guestRows, garageRows, feedbackRows, upcomingRows] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { id: true, fullName: true, phone: true, email: true, telegram: true, city: true },
    }),
    prisma.serviceRequest.findMany({
      where: { clientId: null, guestPhone: { not: null } },
      select: {
        guestPhone: true,
        guestName: true,
        status: true,
        createdAt: true,
        snapshotMake: true,
        snapshotModel: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.clientVehicle.findMany({
      select: { clientId: true, make: true, model: true, year: true, licensePlate: true, vin: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.consultationFeedback.findMany({
      where: { repairAmountMinor: { not: null } },
      select: {
        repairAmountMinor: true,
        session: {
          select: {
            clientId: true,
            guestPhone: true,
            serviceRequest: { select: { clientId: true, guestPhone: true } },
          },
        },
      },
    }),
    prisma.serviceBooking.findMany({
      where: { preferredAt: { gte: new Date() }, status: { in: UPCOMING_BOOKING } },
      select: { clientId: true, guestPhone: true, preferredAt: true },
      orderBy: { preferredAt: 'asc' },
    }),
  ]);

  const totalsByClient = new Map(clientTotals.map((row) => [row.clientId, row]));
  const activeByClient = new Map(clientActive.map((row) => [row.clientId, row._count.id]));
  const vehiclesByClient = new Map();
  for (const row of garageRows) {
    const list = vehiclesByClient.get(row.clientId) || [];
    pushUniqueVehicle(list, row);
    vehiclesByClient.set(row.clientId, list);
  }

  const ltvByKey = new Map();
  for (const row of feedbackRows) {
    const key = ltvBucket(row.session);
    if (!key) continue;
    ltvByKey.set(key, (ltvByKey.get(key) || 0) + (row.repairAmountMinor || 0));
  }

  const nextByClient = new Map();
  const nextByGuest = new Map();
  for (const row of upcomingRows) {
    if (row.clientId && !nextByClient.has(row.clientId)) nextByClient.set(row.clientId, iso(row.preferredAt));
    if (row.guestPhone && !nextByGuest.has(row.guestPhone)) nextByGuest.set(row.guestPhone, iso(row.preferredAt));
  }

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
      city: profile.city || '',
      isGuest: false,
      totalRequests: totals?._count?.id || 0,
      activeRequests: activeByClient.get(profile.id) || 0,
      lastActivityAt: iso(totals?._max?.createdAt),
      vehicles: stripVehicleKeys(vehiclesByClient.get(profile.id) || []),
      ltvMinor: ltvByKey.get(`c:${profile.id}`) || 0,
      nextBookingAt: nextByClient.get(profile.id) || null,
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
      pushUniqueVehicle(existing.vehicles, row);
      continue;
    }
    const vehicles = [];
    pushUniqueVehicle(vehicles, row);
    guests.set(phone, {
      key: `guest:${phone}`,
      guestPhone: phone,
      name: row.guestName || 'Гость',
      phone,
      email: '',
      telegram: '',
      city: '',
      isGuest: true,
      totalRequests: 1,
      activeRequests: ACTIVE_STATUSES.includes(row.status) ? 1 : 0,
      lastActivityAt: iso(row.createdAt),
      vehicles,
      ltvMinor: ltvByKey.get(`g:${phone}`) || 0,
      nextBookingAt: nextByGuest.get(phone) || null,
    });
  }
  items.push(...[...guests.values()].map((item) => ({ ...item, vehicles: stripVehicleKeys(item.vehicles) })));

  let searched = items;
  if (query) {
    searched = searched.filter((item) => {
      const haystack = `${item.name} ${item.phone} ${item.email} ${item.telegram} ${item.city} ${vehicleHaystack(item.vehicles)}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  const counts = {
    all: searched.length,
    active: searched.filter((item) => item.activeRequests > 0).length,
    guests: searched.filter((item) => item.isGuest).length,
  };

  let filtered = searched;
  if (filter === 'active') filtered = filtered.filter((item) => item.activeRequests > 0);
  if (filter === 'guests') filtered = filtered.filter((item) => item.isGuest);

  filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
    if (sort === 'recent') return String(b.lastActivityAt || '').localeCompare(String(a.lastActivityAt || ''));
    if (sort === 'ltv') return (b.ltvMinor || 0) - (a.ltvMinor || 0) || a.name.localeCompare(b.name, 'ru');
    return b.activeRequests - a.activeRequests || a.name.localeCompare(b.name, 'ru');
  });

  const total = filtered.length;
  const start = (pageNum - 1) * take;
  return { items: filtered.slice(start, start + take), total, page: pageNum, pageSize: take, counts };
}

export async function getClientDossier(user, clientId) {
  assertStaff(user);
  const profile = await prisma.user.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      telegram: true,
      city: true,
      preferredContact: true,
      role: true,
      createdAt: true,
    },
  });
  if (!profile) throw new AppError(404, 'Клиент не найден', 'NOT_FOUND');
  const [requests, bookings, consultations, feedbackAgg, serviceRecords, vehicles] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        createdAt: true,
        snapshotMake: true,
        snapshotModel: true,
        snapshotSymptoms: true,
        assignedManager: { select: { fullName: true } },
      },
    }),
    prisma.serviceBooking.findMany({
      where: { clientId },
      orderBy: { preferredAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        preferredAt: true,
        notes: true,
        vehicle: { select: { make: true, model: true, year: true, licensePlate: true } },
      },
    }),
    prisma.consultationSession.findMany({
      where: { clientId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        progressPercent: true,
        serviceCategory: { select: { name: true } },
      },
    }),
    prisma.consultationFeedback.aggregate({
      where: {
        repairAmountMinor: { not: null },
        session: { serviceRequest: { clientId } },
      },
      _sum: { repairAmountMinor: true },
      _count: { id: true },
    }),
    prisma.vehicleServiceRecord.findMany({
      where: { clientId },
      orderBy: { performedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        vehicleId: true,
        performedAt: true,
        mileageKm: true,
        title: true,
        category: true,
        worksDone: true,
        workOrderNumber: true,
        amountMinor: true,
        vehicle: { select: { make: true, model: true, year: true, licensePlate: true } },
      },
    }),
    listVehiclesForDossier(clientId),
  ]);
  const completedRequests = requests.filter((row) => row.status === 'COMPLETED').length;
  const metrics = {
    requestsTotal: requests.length,
    completedRequests,
    ltvMinor: feedbackAgg._sum.repairAmountMinor || 0,
    repairsWithAmount: feedbackAgg._count.id || 0,
    vehiclesCount: vehicles.length,
    nextBookingAt: nextBookingAt(bookings),
  };
  return { profile, requests, bookings, consultations, serviceRecords, metrics, vehicles };
}

export async function getGuestDossier(user, phoneRaw) {
  assertStaff(user);
  const phone = normalizePhone(phoneRaw);
  if (!isValidPhoneDigits(phone)) {
    throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
  }

  const [requests, bookings, contacts, consultations, feedbackAgg] = await Promise.all([
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
        assignedManager: { select: { fullName: true } },
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
    prisma.consultationSession.findMany({
      where: { guestPhone: phone },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        progressPercent: true,
        serviceCategory: { select: { name: true } },
      },
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

  const vehicles = snapshotVehiclesFromRequests(requests);
  const profile = {
    phone,
    fullName: requests[0]?.guestName || bookings[0]?.guestName || contacts[0]?.fullName || 'Гость',
    isGuest: true,
  };
  const completedRequests = requests.filter((row) => row.status === 'COMPLETED').length;
  const metrics = {
    requestsTotal: requests.length,
    completedRequests,
    ltvMinor: feedbackAgg._sum.repairAmountMinor || 0,
    repairsWithAmount: feedbackAgg._count.id || 0,
    vehiclesCount: vehicles.length,
    nextBookingAt: nextBookingAt(bookings),
  };

  return { profile, requests, bookings, contacts, consultations, serviceRecords: [], metrics, vehicles };
}
