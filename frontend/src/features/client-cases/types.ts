import type { ServiceRequestStatus } from '../../types/serviceRequest';
import type { ClientCaseTopic } from './clientCaseTopic';

export type ClientCaseKind = 'request' | 'draft';
export type ClientCaseStage = 'diagnosis' | 'request' | 'booking' | 'done';
export type ClientCaseTab = 'active' | 'archive' | 'drafts';
export type ClientCaseDetailTab = 'progress' | 'diagnosis' | 'messages' | 'booking';

export type ClientCase = {
  id: string;
  kind: ClientCaseKind;
  title: string;
  symptoms: string;
  status: string;
  requestStatus?: ServiceRequestStatus;
  consultationStatus?: string;
  progressStage: ClientCaseStage;
  progressPercent: number;
  progressLabel: string;
  lastActivityAt: string;
  serviceRequestId?: string;
  consultationSessionId?: string;
  bookingId?: string;
  bookingPreferredAt?: string;
  urgency?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vehicleId?: string | null;
  unreadCount?: number;
  topic: ClientCaseTopic;
};

export type ConsultationCaseInput = {
  id: string;
  status: string;
  createdAt: string;
  progressPercent?: number | null;
  make?: string | null;
  model?: string | null;
  symptoms?: string | null;
  vehicleId?: string | null;
  extracted?: { make?: string | null; model?: string | null; symptoms?: string | null; year?: number | null } | null;
  serviceRequest?: { id: string; status: string } | null;
  intent?: 'diagnostic' | 'service' | 'unknown' | null;
  serviceType?: string | null;
  serviceCategoryName?: string | null;
};

export type RequestCaseInput = {
  id: string;
  status: ServiceRequestStatus;
  createdAt: string;
  snapshotMake?: string | null;
  snapshotModel?: string | null;
  snapshotSymptoms?: string | null;
  vehicleId?: string | null;
  consultationSessionId?: string;
  unreadCount?: number;
  consultationSession?: {
    id?: string;
    status?: string;
    progressPercent?: number | null;
    intent?: 'diagnostic' | 'service' | 'unknown' | null;
    serviceType?: string | null;
    serviceCategoryName?: string | null;
    diagnosis?: { urgency?: string } | null;
  } | null;
};

export type BookingCaseInput = {
  id: string;
  status: string;
  preferredAt: string;
  serviceRequest?: { id: string; status: string } | null;
};
