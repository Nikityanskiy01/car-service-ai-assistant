export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';
  blocked: boolean;
};

export type AnalyticsKpi = {
  consultations: number;
  serviceRequests: number;
  bookings: number;
  conversion: string;
  funnel: {
    consultationsTotal: number;
    requestsTotal: number;
    bookingsTotal: number;
    conversionConsultationToRequest: number;
    conversionRequestToBooking: number;
    conversionCompleted: number;
    cancelledRequests: number;
  };
  managers: Array<{
    manager: { id: string; fullName: string; email: string };
    activityMessages: number;
    activeRequests: number;
  }>;
};

export type AuditEvent = {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  payload?: unknown;
};

export type CmsItem = {
  id: string;
  kind: string;
  title: string;
  published: boolean;
  orderIndex: number;
};

export type ContactSubmission = {
  id: string;
  fullName: string;
  phone: string;
  message?: string | null;
  createdAt?: string;
};

export type ServiceBooking = {
  id: string;
  status: string;
  preferredAt: string;
  guestName?: string | null;
  client?: { fullName?: string; phone?: string };
  serviceName?: string | null;
  comment?: string | null;
};

export type ClientDossier = {
  profile: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    createdAt: string;
  };
  vehicles: Array<{ make?: string; model?: string; year?: number }>;
  requests: Array<{ id: string; status: string; createdAt: string }>;
  consultations: Array<{ id: string; status: string; createdAt: string }>;
  bookings: Array<{ id: string; status: string; preferredAt: string }>;
};
