import prisma from '../../../lib/prisma.js';

export async function logStatusChange({ requestId, actorId, fromStatus, toStatus }: any) {
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

export function serializeExtracted(extracted: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  symptoms?: string | null;
  problemConditions?: string | null;
  obdCodes?: string | null;
} | null) {
  if (!extracted) return null;
  return {
    make: extracted.make ?? null,
    model: extracted.model ?? null,
    year: extracted.year ?? null,
    mileage: extracted.mileage ?? null,
    symptoms: extracted.symptoms ?? null,
    problemConditions: extracted.problemConditions ?? null,
    obdCodes: extracted.obdCodes ?? null,
  };
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
