export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';
  blocked: boolean;
  createdAt?: string;
};

export type AnalyticsKpi = {
  periodDays?: number | null;
  consultations: number;
  serviceRequests: number;
  bookings: number;
  conversion: string;
  funnel: {
    consultationsTotal: number;
    requestsTotal: number;
    bookingsTotal: number;
    completedRequests?: number;
    conversionConsultationToRequest: number;
    conversionRequestToBooking: number;
    conversionCompleted: number;
    cancelledRequests: number;
    steps?: Array<{ key: string; label: string; count: number }>;
    biggestDropOff?: { from: string; to: string; dropPercent: number } | null;
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
  actor?: { id?: string; fullName?: string; email?: string } | null;
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
  status?: 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'CLOSED';
  source?: string;
  processedAt?: string | null;
  convertedRequestId?: string | null;
  closedReason?: string | null;
  createdAt?: string;
};

export type BookingVehicle = {
  id: string;
  make: string;
  model: string;
  year?: number | null;
  licensePlate?: string | null;
};

export type ServiceBooking = {
  id: string;
  status: string;
  preferredAt: string;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  notes?: string | null;
  serviceRequestId?: string | null;
  vehicleId?: string | null;
  vehicle?: BookingVehicle | null;
  client?: { fullName?: string; phone?: string; email?: string };
  serviceRequest?: {
    id: string;
    status: string;
    assignedManagerId?: string | null;
    snapshotMake?: string | null;
    snapshotModel?: string | null;
    snapshotSymptoms?: string | null;
  } | null;
  serviceName?: string | null;
  comment?: string | null;
};

export type DossierVehicle = {
  id?: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  notes?: string | null;
  licensePlate?: string | null;
  color?: string | null;
  currentMileageKm?: number | null;
  photoUrl?: string | null;
  lastServiceAt?: string | null;
  lastServiceTitle?: string | null;
  lastServiceCategory?: string | null;
};

export type DossierRequestRow = {
  id: string;
  status: string;
  createdAt: string;
  snapshotMake?: string | null;
  snapshotModel?: string | null;
  snapshotSymptoms?: string | null;
  guestName?: string | null;
  assignedManager?: { fullName: string } | null;
};

export type DossierBookingRow = {
  id: string;
  status: string;
  preferredAt: string;
  notes?: string | null;
  guestName?: string | null;
  vehicle?: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    licensePlate?: string | null;
  } | null;
};

export type DossierConsultationRow = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  progressPercent?: number;
  serviceCategory?: { name: string } | null;
};

export type DossierServiceRecord = {
  id: string;
  vehicleId?: string;
  performedAt: string;
  mileageKm?: number | null;
  title: string;
  category: string;
  worksDone?: string | null;
  workOrderNumber?: string | null;
  amountMinor?: number | null;
  vehicle?: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    licensePlate?: string | null;
  } | null;
};

export type DossierMetrics = {
  requestsTotal: number;
  completedRequests: number;
  ltvMinor: number;
  repairsWithAmount: number;
  vehiclesCount?: number;
  nextBookingAt?: string | null;
};

export type GuestDossier = {
  profile: { phone: string; fullName: string; isGuest: true };
  vehicles?: DossierVehicle[];
  requests: DossierRequestRow[];
  bookings: DossierBookingRow[];
  consultations?: DossierConsultationRow[];
  contacts: Array<{
    id: string;
    fullName: string;
    message?: string | null;
    status: string;
    createdAt: string;
  }>;
  serviceRecords?: DossierServiceRecord[];
  metrics?: DossierMetrics;
};

export type ClientDossier = {
  profile: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    telegram?: string | null;
    city?: string | null;
    preferredContact?: string | null;
    createdAt: string;
  };
  vehicles: DossierVehicle[];
  requests: DossierRequestRow[];
  consultations: DossierConsultationRow[];
  bookings: DossierBookingRow[];
  serviceRecords?: DossierServiceRecord[];
  metrics?: DossierMetrics;
};
