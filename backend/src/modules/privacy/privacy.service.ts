import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import * as securityService from '../users/security.service.js';
import { deleteAvatarFile } from '../../lib/avatarStorage.js';
import { deleteVehiclePhotoFile } from '../../lib/vehiclePhotoStorage.js';

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

export async function exportMyData(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      city: true,
      telegram: true,
      preferredContact: true,
      role: true,
      createdAt: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    },
  });
  if (!user) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');

  const [vehicles, requests, bookings, sessions, messages, consents, loginEvents] = await Promise.all([
    prisma.clientVehicle.findMany({ where: { clientId: userId } }),
    prisma.serviceRequest.findMany({
      where: { clientId: userId },
      select: {
        id: true,
        status: true,
        snapshotMake: true,
        snapshotModel: true,
        snapshotSymptoms: true,
        createdAt: true,
      },
    }),
    prisma.serviceBooking.findMany({
      where: { clientId: userId },
      select: { id: true, status: true, preferredAt: true, createdAt: true },
    }),
    prisma.consultationSession.findMany({
      where: { clientId: userId },
      select: { id: true, status: true, createdAt: true, progressPercent: true },
    }),
    prisma.message.findMany({
      where: { session: { clientId: userId } },
      select: { id: true, sessionId: true, sender: true, content: true, createdAt: true },
    }),
    prisma.consentEvent.findMany({
      where: { userId },
      select: { purpose: true, policyVersion: true, createdAt: true },
    }),
    prisma.userLoginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { success: true, method: true, createdAt: true, ip: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      ...user,
      createdAt: serializeDate(user.createdAt),
      emailVerifiedAt: serializeDate(user.emailVerifiedAt),
      phoneVerifiedAt: serializeDate(user.phoneVerifiedAt),
    },
    vehicles,
    serviceRequests: requests,
    bookings,
    consultations: sessions,
    messages,
    consents,
    loginEvents,
  };
}

async function wipeRelatedPersonalData(userId) {
  const sessions = await prisma.consultationSession.findMany({
    where: { clientId: userId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  const vehicles = await prisma.clientVehicle.findMany({
    where: { clientId: userId },
    select: { id: true, photoUrl: true },
  });

  if (sessionIds.length) {
    await prisma.consultationCaseEmbedding.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.message.updateMany({
      where: { sessionId: { in: sessionIds } },
      data: { content: '[удалено]' },
    });
    await prisma.extractedDiagnosticData.updateMany({
      where: { sessionId: { in: sessionIds } },
      data: { symptoms: null, problemConditions: null, obdCodes: null },
    });
    await prisma.consultationSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { guestName: null, guestPhone: null, preliminaryNote: null, flowState: null },
    });
  }

  await prisma.serviceRequest.updateMany({
    where: { clientId: userId },
    data: { snapshotSymptoms: null, snapshotMake: null, snapshotModel: null },
  });
  await prisma.requestFollowUpMessage.updateMany({
    where: { request: { clientId: userId } },
    data: { body: '[удалено]' },
  });
  await prisma.serviceBooking.updateMany({
    where: { clientId: userId },
    data: { guestName: null, guestPhone: null, guestEmail: null, notes: null },
  });
  await prisma.userLoginEvent.deleteMany({ where: { userId } });

  for (const vehicle of vehicles) {
    if (vehicle.photoUrl) await deleteVehiclePhotoFile(vehicle.photoUrl).catch(() => {});
  }
  await prisma.clientVehicle.updateMany({
    where: { clientId: userId },
    data: { vin: null, licensePlate: null, notes: null, photoUrl: null, color: null },
  });
}

export async function deleteMyAccount(userId, { password, code }: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Запрошенные данные не найдены.', 'NOT_FOUND');
  if (user.role === 'ADMINISTRATOR' || user.role === 'MANAGER') {
    throw new AppError(400, 'Удаление учётной записи сотрудника выполняется администратором', 'BAD_REQUEST');
  }
  await securityService.assertSensitiveAction(user, { password, code });

  await wipeRelatedPersonalData(userId);
  if (user.avatarUrl) await deleteAvatarFile(user.avatarUrl).catch(() => {});

  const tombstoneEmail = `deleted-${user.id}@invalid.local`;
  const tombstonePhone = `7${crypto.randomInt(100_000_000, 999_999_999).toString().padStart(10, '0')}`.slice(0, 11);

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationCode.deleteMany({ where: { userId } }),
    prisma.authOtpChallenge.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: tombstoneEmail,
        fullName: 'Удалённый аккаунт',
        phone: tombstonePhone,
        emailProfile: null,
        city: null,
        telegram: null,
        preferredContact: null,
        avatarUrl: null,
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpBackupHashes: [],
        telegramChatId: null,
        blocked: true,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        tokenVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
  ]);
  invalidateAuthUserCache(userId);
  return { ok: true };
}
