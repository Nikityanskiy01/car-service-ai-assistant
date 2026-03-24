import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

export async function createBooking(user, { preferredAt, serviceRequestId, notes }) {
  const at = new Date(preferredAt);
  if (Number.isNaN(at.getTime())) throw new AppError(400, 'Invalid preferredAt', 'BAD_REQUEST');
  if (serviceRequestId) {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
    if (!sr || sr.clientId !== user.id) throw new AppError(400, 'Invalid serviceRequestId', 'BAD_REQUEST');
  }
  return prisma.serviceBooking.create({
    data: {
      clientId: user.id,
      preferredAt: at,
      serviceRequestId: serviceRequestId || null,
      notes: notes ? String(notes).slice(0, 2000) : null,
    },
  });
}

export async function listBookings(user) {
  if (user.role === 'MANAGER' || user.role === 'ADMINISTRATOR') {
    return prisma.serviceBooking.findMany({
      orderBy: { preferredAt: 'asc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        serviceRequest: { select: { id: true, status: true } },
      },
    });
  }
  if (user.role === 'CLIENT') {
    return prisma.serviceBooking.findMany({
      where: { clientId: user.id },
      orderBy: { preferredAt: 'desc' },
      include: { serviceRequest: { select: { id: true, status: true } } },
    });
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function patchBooking(bookingId, user, { status }) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }
  return prisma.serviceBooking.update({
    where: { id: bookingId },
    data: { status },
    include: {
      client: { select: { id: true, fullName: true, phone: true, email: true } },
      serviceRequest: { select: { id: true, status: true } },
    },
  });
}
