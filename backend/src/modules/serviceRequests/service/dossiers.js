import prisma from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../../contact/contact.service.js';
import { listVehiclesForDossier } from '../../vehicles/vehicles.service.js';

export async function getClientDossier(user, clientId) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  const profile = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
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
      select: { id: true, status: true, updatedAt: true, progressPercent: true },
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
