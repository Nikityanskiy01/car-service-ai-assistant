import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { buildClientCasesFromDb, serializeClientCase } from '../../lib/clientCases.js';
import { countUnreadMessagesForClient } from '../requestMessages/requestMessages.service.js';

function toPublic(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    emailProfile: u.emailProfile,
  };
}

export async function getMe(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, 'Not found', 'NOT_FOUND');
  return toPublic(u);
}

export async function patchMe(userId, data) {
  let phone = data.phone;
  if (phone != null) {
    const digits = normalizePhone(phone);
    if (!isValidPhoneDigits(digits)) {
      throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
    }
    phone = digits;
  }
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.fullName != null ? { fullName: data.fullName } : {}),
      ...(data.phone != null ? { phone } : {}),
      ...(data.emailProfile != null ? { emailProfile: data.emailProfile } : {}),
    },
  });
  return toPublic(u);
}

export async function getMeSummary(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Not found', 'NOT_FOUND');

  const [consultations, requests, bookings, unreadMessagesCount] = await Promise.all([
    prisma.consultationSession.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        extracted: true,
        serviceRequest: { select: { id: true, status: true } },
      },
    }),
    prisma.serviceRequest.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        consultationSession: {
          select: {
            id: true,
            status: true,
            progressPercent: true,
            flowState: true,
          },
        },
      },
    }),
    prisma.serviceBooking.findMany({
      where: { clientId: userId },
      orderBy: { preferredAt: 'asc' },
      take: 30,
      include: { serviceRequest: { select: { id: true, status: true } } },
    }),
    countUnreadMessagesForClient(userId),
  ]);

  const cases = buildClientCasesFromDb(consultations, requests, bookings);
  const activeCases = cases.filter(
    (item) =>
      item.kind === 'request' &&
      item.requestStatus !== 'COMPLETED' &&
      item.requestStatus !== 'CANCELLED',
  );
  const draftCases = cases.filter((item) => item.kind === 'draft');

  const now = Date.now();
  const nextBooking =
    bookings
      .filter(
        (booking) =>
          booking.status !== 'CANCELLED' &&
          new Date(booking.preferredAt).getTime() >= now - 3600000,
      )
      .sort((a, b) => new Date(a.preferredAt).getTime() - new Date(b.preferredAt).getTime())[0] ||
    null;

  const draft = draftCases[0] || null;

  return {
    profile: {
      fullName: user.fullName,
      phone: user.phone,
    },
    activeCasesCount: activeCases.length,
    unreadMessagesCount,
    hasAnyHistory: cases.length > 0,
    nextBooking: nextBooking
      ? {
          id: nextBooking.id,
          preferredAt: nextBooking.preferredAt.toISOString(),
          status: nextBooking.status,
        }
      : null,
    draftConsultation: draft
      ? {
          id: draft.consultationSessionId,
          make: draft.make,
          model: draft.model,
          symptom: draft.symptoms,
          status: draft.consultationStatus,
        }
      : null,
    recentActiveCases: activeCases.slice(0, 5).map(serializeClientCase),
  };
}
