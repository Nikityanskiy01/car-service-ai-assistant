import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

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
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.fullName != null ? { fullName: data.fullName } : {}),
      ...(data.phone != null ? { phone: data.phone } : {}),
      ...(data.emailProfile != null ? { emailProfile: data.emailProfile } : {}),
    },
  });
  return toPublic(u);
}
