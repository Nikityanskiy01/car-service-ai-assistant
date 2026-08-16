import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { assertPreferredAtInBookingWindow } from '../../lib/bookingHours.js';
import { notifyBookingCreated } from '../notifications/clientNotify.service.js';

const BOOKING_INCLUDE = {
  client: { select: { id: true, fullName: true, phone: true, email: true } },
  vehicle: { select: { id: true, make: true, model: true, year: true, licensePlate: true } },
  serviceRequest: {
    select: {
      id: true,
      status: true,
      assignedManagerId: true,
      snapshotMake: true,
      snapshotModel: true,
      snapshotSymptoms: true,
    },
  },
};

/**
 * Менеджер назначает слот по заявке. Статус PENDING: клиент видит запись,
 * но она не окончательная, пока её не согласуют и не подтвердят.
 */
export async function createStaffBooking(user, { preferredAt, serviceRequestId, notes, vehicleId }: any) {
  if (user.role !== 'MANAGER' && user.role !== 'ADMINISTRATOR') {
    throw new AppError(403, 'Недостаточно прав для выполнения действия.', 'FORBIDDEN');
  }
  if (!serviceRequestId) {
    throw new AppError(400, 'Укажите заявку, к которой назначаете запись', 'BAD_REQUEST');
  }

  const at = new Date(preferredAt);
  if (Number.isNaN(at.getTime())) throw new AppError(400, 'Укажите корректную дату и время.', 'BAD_REQUEST');
  const slot = assertPreferredAtInBookingWindow(at);
  if (!slot.ok) throw new AppError(400, slot.message, 'BAD_REQUEST');
  if (at.getTime() <= Date.now()) {
    throw new AppError(400, 'Выберите дату и время в будущем', 'BAD_REQUEST');
  }

  const request = await prisma.serviceRequest.findUnique({ where: { id: serviceRequestId } });
  if (!request) throw new AppError(404, 'Заявка не найдена', 'NOT_FOUND');
  if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
    throw new AppError(400, 'Нельзя назначить запись по закрытой заявке', 'BAD_REQUEST');
  }

  const resolvedVehicleId = vehicleId || request.vehicleId || null;
  if (resolvedVehicleId && request.clientId) {
    const vehicle = await prisma.clientVehicle.findFirst({
      where: { id: resolvedVehicleId, clientId: request.clientId },
      select: { id: true },
    });
    if (!vehicle) throw new AppError(400, 'Автомобиль не найден в гараже клиента', 'BAD_REQUEST');
  }

  const guestName = request.clientId ? null : (request.guestName || 'Клиент').slice(0, 120);
  const guestPhone = request.clientId ? null : request.guestPhone;
  const guestEmail = request.clientId ? null : request.guestEmail;

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceBooking.create({
      data: {
        clientId: request.clientId,
        guestName,
        guestPhone,
        guestEmail,
        preferredAt: at,
        serviceRequestId: request.id,
        vehicleId: resolvedVehicleId,
        notes: notes ? String(notes).slice(0, 2000) : null,
        status: 'PENDING',
      },
      include: BOOKING_INCLUDE,
    });
    await tx.serviceBookingAuditLog.create({
      data: {
        bookingId: created.id,
        actorId: user.id,
        changes: {
          status: { from: null, to: 'PENDING' },
          preferredAt: { from: null, to: at.toISOString() },
          serviceRequestId: { from: null, to: request.id },
        },
      },
    });
    return created;
  });

  await notifyBookingCreated(booking, { proposedByStaff: true });
  return booking;
}
