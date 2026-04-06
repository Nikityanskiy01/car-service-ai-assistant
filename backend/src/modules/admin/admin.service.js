import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

export async function listUsers({ limit = 100, offset = 0 } = {}) {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    skip: offset,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      blocked: true,
      createdAt: true,
    },
  });
}

export async function patchUserRole(userId, role) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, 'User not found', 'NOT_FOUND');
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, role: true, blocked: true },
  });
}

export async function blockUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { blocked: true },
  });
}

export async function unblockUser(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { blocked: false },
  });
}
