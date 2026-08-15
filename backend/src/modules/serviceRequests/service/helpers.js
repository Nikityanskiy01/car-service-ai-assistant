import prisma from '../../../lib/prisma.js';

export async function logStatusChange({ requestId, actorId, fromStatus, toStatus }) {
  if (fromStatus === toStatus) return;
  await prisma.serviceRequestStatusLog.create({
    data: {
      requestId,
      actorId: actorId || null,
      fromStatus: fromStatus || null,
      toStatus,
    },
  });
}

export function findFullServiceRequest(id) {
  return prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, fullName: true, phone: true, email: true, emailProfile: true },
      },
      consultationSession: {
        include: { messages: { orderBy: { createdAt: 'asc' } }, extracted: true, recommendations: true },
      },
    },
  });
}
