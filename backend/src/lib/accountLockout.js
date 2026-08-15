import prisma from './prisma.js';
import { AppError } from './errors.js';
import { INVALID_CREDENTIALS_MESSAGE } from './authSecurity.js';

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export function isUserLocked(user) {
  if (!user?.lockedUntil) return false;
  return new Date(user.lockedUntil).getTime() > Date.now();
}

export async function assertNotLocked(user) {
  if (isUserLocked(user)) {
    throw new AppError(401, INVALID_CREDENTIALS_MESSAGE, 'UNAUTHORIZED');
  }
}

export async function recordFailedLogin(userId) {
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, failedLoginCount: true, lockedUntil: true },
  });
  if (!user) return;
  const next = (user.failedLoginCount || 0) + 1;
  const lockedUntil = next >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: next, lockedUntil },
  });
}

export async function clearFailedLogins(userId) {
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}
