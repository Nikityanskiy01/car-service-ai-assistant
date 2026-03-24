import prisma from '../../lib/prisma.js';

export async function summary() {
  const [users, sessions, requests, bookings] = await Promise.all([
    prisma.user.count(),
    prisma.consultationSession.count(),
    prisma.serviceRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.serviceBooking.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const byStatus = Object.fromEntries(requests.map((r) => [r.status, r._count.id]));

  return {
    usersTotal: users,
    consultationsTotal: sessions,
    serviceRequestsByStatus: byStatus,
    bookingsByStatus: Object.fromEntries(bookings.map((b) => [b.status, b._count.id])),
  };
}
