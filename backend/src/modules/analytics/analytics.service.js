import prisma from '../../lib/prisma.js';

export async function summary() {
  const [users, sessions, requests, bookings, contacts] = await Promise.all([
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
    prisma.contactSubmission.count(),
  ]);

  const byStatus = Object.fromEntries(requests.map((r) => [r.status, r._count.id]));

  return {
    usersTotal: users,
    consultationsTotal: sessions,
    contactsTotal: contacts,
    serviceRequestsByStatus: byStatus,
    bookingsByStatus: Object.fromEntries(bookings.map((b) => [b.status, b._count.id])),
  };
}

export async function kpiDashboard() {
  const [consultationsTotal, requestsTotal, bookingsTotal, completedRequests, cancelledRequests, managers] =
    await Promise.all([
      prisma.consultationSession.count(),
      prisma.serviceRequest.count(),
      prisma.serviceBooking.count(),
      prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.serviceRequest.count({ where: { status: 'CANCELLED' } }),
      prisma.user.findMany({
        where: { role: 'MANAGER' },
        select: { id: true, fullName: true, email: true },
      }),
    ]);

  const conversionConsultationToRequest = consultationsTotal ? Math.round((requestsTotal / consultationsTotal) * 100) : 0;
  const conversionRequestToBooking = requestsTotal ? Math.round((bookingsTotal / requestsTotal) * 100) : 0;
  const conversionCompleted = requestsTotal ? Math.round((completedRequests / requestsTotal) * 100) : 0;

  const workloads = await Promise.all(
    managers.map(async (m) => {
      const [messages, activeRequests] = await Promise.all([
        prisma.requestFollowUpMessage.count({ where: { authorId: m.id } }),
        prisma.serviceRequest.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'SCHEDULED'] } } }),
      ]);
      return {
        manager: m,
        activityMessages: messages,
        activeRequests,
      };
    }),
  );

  return {
    funnel: {
      consultationsTotal,
      requestsTotal,
      bookingsTotal,
      conversionConsultationToRequest,
      conversionRequestToBooking,
      conversionCompleted,
      cancelledRequests,
    },
    managers: workloads,
  };
}

export async function kpiCsv() {
  const kpi = await kpiDashboard();
  const lines = ['metric,value'];
  lines.push(`consultations_total,${kpi.funnel.consultationsTotal}`);
  lines.push(`requests_total,${kpi.funnel.requestsTotal}`);
  lines.push(`bookings_total,${kpi.funnel.bookingsTotal}`);
  lines.push(`conv_consult_to_request_pct,${kpi.funnel.conversionConsultationToRequest}`);
  lines.push(`conv_request_to_booking_pct,${kpi.funnel.conversionRequestToBooking}`);
  lines.push(`conv_completed_requests_pct,${kpi.funnel.conversionCompleted}`);
  lines.push(`cancelled_requests_total,${kpi.funnel.cancelledRequests}`);
  for (const row of kpi.managers) {
    lines.push(`manager_${sanitize(row.manager.fullName)}_messages,${row.activityMessages}`);
    lines.push(`manager_${sanitize(row.manager.fullName)}_active_requests,${row.activeRequests}`);
  }
  return lines.join('\n');
}

function sanitize(v) {
  return String(v || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
