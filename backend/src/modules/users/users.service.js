import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { isValidPhoneDigits, normalizePhone } from '../contact/contact.service.js';
import { buildClientCasesFromDb, serializeClientCase } from '../../lib/clientCases.js';
import { listUnreadThreadsForClient } from '../requestMessages/requestMessages.service.js';
import {
  avatarMimeFromKey,
  deleteAvatarFile,
  readAvatarFile,
  saveAvatarFile,
  validateAvatarInput,
} from '../../lib/avatarStorage.js';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  emailProfile: true,
  avatarUrl: true,
  city: true,
  telegram: true,
  preferredContact: true,
  createdAt: true,
  totpEnabledAt: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  telegramChatId: true,
};

function toPublic(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    emailProfile: u.emailProfile,
    avatarUrl: u.avatarUrl ? '/api/users/me/avatar' : null,
    city: u.city,
    telegram: u.telegram,
    preferredContact: u.preferredContact,
    createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
    totpEnabled: Boolean(u.totpEnabledAt),
    emailVerified: Boolean(u.emailVerifiedAt),
    phoneVerified: Boolean(u.phoneVerifiedAt),
    telegramLinked: Boolean(u.telegramChatId),
  };
}

export async function getMe(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
  if (!u) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  return toPublic(u);
}

export async function patchMe(userId, data) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerifiedAt: true },
  });
  if (!current) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  let phone = data.phone;
  const phoneChanged = phone != null && normalizePhone(phone) !== current.phone;
  if (phone != null) {
    const digits = normalizePhone(phone);
    if (!isValidPhoneDigits(digits)) {
      throw new AppError(400, 'Укажите корректный номер телефона', 'BAD_REQUEST');
    }
    phone = digits;
    if (phoneChanged) {
      const taken = await prisma.user.findFirst({
        where: { phone, phoneVerifiedAt: { not: null }, id: { not: userId } },
        select: { id: true },
      });
      if (taken) {
        throw new AppError(400, 'Этот номер уже подтверждён в другом аккаунте', 'PHONE_TAKEN');
      }
    }
  }

  let telegram = data.telegram;
  if (telegram != null) {
    telegram = String(telegram).trim().replace(/^@/, '') || null;
  }

  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.fullName != null ? { fullName: data.fullName } : {}),
      ...(data.phone != null ? { phone } : {}),
      ...(phoneChanged
        ? { phoneVerifiedAt: null, loginSmsEnabled: false }
        : {}),
      ...(data.emailProfile !== undefined ? { emailProfile: data.emailProfile } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.telegram !== undefined ? { telegram } : {}),
      ...(data.preferredContact !== undefined ? { preferredContact: data.preferredContact } : {}),
    },
    select: USER_SELECT,
  });
  return toPublic(u);
}

export async function uploadAvatar(userId, { mimeType, contentBase64 }) {
  const parsed = validateAvatarInput({ mimeType, contentBase64 });
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!current) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const storageKey = await saveAvatarFile(parsed.buffer, parsed.ext);
  try {
    const u = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: storageKey },
      select: USER_SELECT,
    });
    if (current.avatarUrl && current.avatarUrl !== storageKey) {
      await deleteAvatarFile(current.avatarUrl);
    }
    return toPublic(u);
  } catch (err) {
    await deleteAvatarFile(storageKey);
    throw err;
  }
}

export async function removeAvatar(userId) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!current) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (current.avatarUrl) {
    await deleteAvatarFile(current.avatarUrl);
  }
  const u = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: USER_SELECT,
  });
  return toPublic(u);
}

export async function getAvatar(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  if (!u?.avatarUrl) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  const buffer = await readAvatarFile(u.avatarUrl);
  return { buffer, mimeType: avatarMimeFromKey(u.avatarUrl) };
}

export async function getMeSummary(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const [consultations, requests, bookings, unread] = await Promise.all([
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
    listUnreadThreadsForClient(userId),
  ]);
  const unreadByRequestId = new Map(unread.threads.map((thread) => [thread.requestId, thread.unreadCount]));

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
    unreadMessagesCount: unread.count,
    unreadThreads: unread.threads,
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
    recentActiveCases: activeCases.slice(0, 5).map((row) => ({
      ...serializeClientCase(row),
      unreadCount: unreadByRequestId.get(row.id) || 0,
    })),
  };
}
