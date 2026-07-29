import prisma from '../../lib/prisma.js';

function buildFunnelSteps(counts) {
  const funnelSteps = [
    { key: 'consultations', label: 'Консультации', count: counts.consultationsTotal },
    { key: 'requests', label: 'Заявки', count: counts.requestsTotal },
    { key: 'bookings', label: 'Записи', count: counts.bookingsTotal },
    { key: 'completed', label: 'Завершено', count: counts.completedRequests },
  ];

  let biggestDropOff = null;
  for (let i = 0; i < funnelSteps.length - 1; i += 1) {
    const from = funnelSteps[i].count;
    const to = funnelSteps[i + 1].count;
    if (from > 0) {
      const drop = Math.round(((from - to) / from) * 100);
      if (!biggestDropOff || drop > biggestDropOff.dropPercent) {
        biggestDropOff = {
          from: funnelSteps[i].label,
          to: funnelSteps[i + 1].label,
          dropPercent: drop,
        };
      }
    }
  }

  return { steps: funnelSteps, biggestDropOff };
}

function periodSince(days) {
  const periodDays = Math.min(Math.max(1, Number(days) || 30), 90);
  const since = new Date();
  since.setDate(since.getDate() - periodDays);
  return { periodDays, since };
}

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

export async function kpiDashboard({ days } = {}) {
  const hasPeriod = days != null;
  const { periodDays, since } = hasPeriod ? periodSince(days) : { periodDays: null, since: null };
  const sessionWhere = since ? { createdAt: { gte: since } } : {};
  const requestWhere = since ? { createdAt: { gte: since } } : {};
  const bookingWhere = since ? { createdAt: { gte: since } } : {};

  const [consultationsTotal, requestsTotal, bookingsTotal, completedRequests, cancelledRequests, managers] =
    await Promise.all([
      prisma.consultationSession.count({ where: sessionWhere }),
      prisma.serviceRequest.count({ where: requestWhere }),
      prisma.serviceBooking.count({ where: bookingWhere }),
      prisma.serviceRequest.count({ where: { ...requestWhere, status: 'COMPLETED' } }),
      prisma.serviceRequest.count({ where: { ...requestWhere, status: 'CANCELLED' } }),
      prisma.user.findMany({
        where: { role: 'MANAGER' },
        select: { id: true, fullName: true, email: true },
      }),
    ]);

  const conversionConsultationToRequest = consultationsTotal ? Math.round((requestsTotal / consultationsTotal) * 100) : 0;
  const conversionRequestToBooking = requestsTotal ? Math.round((bookingsTotal / requestsTotal) * 100) : 0;
  const conversionCompleted = requestsTotal ? Math.round((completedRequests / requestsTotal) * 100) : 0;

  const { steps, biggestDropOff } = buildFunnelSteps({
    consultationsTotal,
    requestsTotal,
    bookingsTotal,
    completedRequests,
  });

  const workloads = await Promise.all(
    managers.map(async (m) => {
      const messageWhere = since ? { authorId: m.id, createdAt: { gte: since } } : { authorId: m.id };
      const [messages, activeRequests] = await Promise.all([
        prisma.requestFollowUpMessage.count({ where: messageWhere }),
        prisma.serviceRequest.count({
          where: {
            assignedManagerId: m.id,
            status: { in: ['NEW', 'IN_PROGRESS', 'SCHEDULED'] },
          },
        }),
      ]);
      return {
        manager: m,
        activityMessages: messages,
        activeRequests,
      };
    }),
  );

  return {
    periodDays,
    consultations: consultationsTotal,
    serviceRequests: requestsTotal,
    bookings: bookingsTotal,
    conversion: `${conversionConsultationToRequest}%`,
    funnel: {
      consultationsTotal,
      requestsTotal,
      bookingsTotal,
      completedRequests,
      cancelledRequests,
      conversionConsultationToRequest,
      conversionRequestToBooking,
      conversionCompleted,
      steps,
      biggestDropOff,
    },
    managers: workloads,
  };
}

export async function managerKpiDashboard(user, { days = 7 } = {}) {
  const periodDays = Math.min(Math.max(1, Number(days) || 7), 90);
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const requestWhere = { createdAt: { gte: since } };
  const managerId = user?.id;

  const [
    consultationsTotal,
    requestsTotal,
    bookingsTotal,
    completedRequests,
    cancelledRequests,
    myActiveRequests,
    myMessages,
    contactsConverted,
  ] = await Promise.all([
    prisma.consultationSession.count({ where: { createdAt: { gte: since } } }),
    prisma.serviceRequest.count({ where: requestWhere }),
    prisma.serviceBooking.count({ where: { createdAt: { gte: since } } }),
    prisma.serviceRequest.count({ where: { ...requestWhere, status: 'COMPLETED' } }),
    prisma.serviceRequest.count({ where: { ...requestWhere, status: 'CANCELLED' } }),
    prisma.serviceRequest.count({
      where: {
        assignedManagerId: managerId,
        status: { in: ['NEW', 'IN_PROGRESS', 'SCHEDULED'] },
      },
    }),
    prisma.requestFollowUpMessage.count({
      where: { authorId: managerId, createdAt: { gte: since } },
    }),
    prisma.contactSubmission.count({
      where: { status: 'CONVERTED', processedAt: { gte: since } },
    }),
  ]);

  const conversionConsultationToRequest = consultationsTotal
    ? Math.round((requestsTotal / consultationsTotal) * 100)
    : 0;
  const conversionRequestToBooking = requestsTotal ? Math.round((bookingsTotal / requestsTotal) * 100) : 0;
  const conversionCompleted = requestsTotal ? Math.round((completedRequests / requestsTotal) * 100) : 0;

  const funnelSteps = [
    { key: 'consultations', label: 'Консультации', count: consultationsTotal },
    { key: 'requests', label: 'Заявки', count: requestsTotal },
    { key: 'bookings', label: 'Записи', count: bookingsTotal },
    { key: 'completed', label: 'Завершено', count: completedRequests },
  ];

  const { biggestDropOff } = buildFunnelSteps({
    consultationsTotal,
    requestsTotal,
    bookingsTotal,
    completedRequests,
  });

  return {
    periodDays,
    personal: {
      activeRequests: myActiveRequests,
      messagesSent: myMessages,
      contactsConverted,
    },
    funnel: {
      consultationsTotal,
      requestsTotal,
      bookingsTotal,
      completedRequests,
      cancelledRequests,
      conversionConsultationToRequest,
      conversionRequestToBooking,
      conversionCompleted,
      steps: funnelSteps,
      biggestDropOff,
    },
  };
}

export async function kpiCsv({ days } = {}) {
  const kpi = await kpiDashboard({ days });
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

export { getAiFeedbackReport, getAiFeedbackCsv } from '../../services/consultationFeedback.service.js';

function sanitize(v) {
  return String(v || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
