import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { invalidateAuthUserCache } from '../../middleware/authJwt.js';
import * as securityService from '../users/security.service.js';

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
  if (!user) throw new AppError(404, 'Not found', 'NOT_FOUND');

  const [vehicles, requests, bookings, sessions, consents, loginEvents] = await Promise.all([
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
      select: { id: true, status: true, scheduledAt: true, createdAt: true },
    }),
    prisma.consultationSession.findMany({
      where: { clientId: userId },
      select: { id: true, status: true, createdAt: true, progressPercent: true },
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
    consents,
    loginEvents,
  };
}

export async function deleteMyAccount(userId, { password, code }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new AppError(404, 'Not found', 'NOT_FOUND');
  if (user.role === 'ADMINISTRATOR' || user.role === 'MANAGER') {
    throw new AppError(400, 'Удаление учётной записи сотрудника выполняется администратором', 'BAD_REQUEST');
  }
  await securityService.assertSensitiveAction(user, { password, code });

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
