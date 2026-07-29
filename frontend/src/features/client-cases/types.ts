import type { ServiceRequestStatus } from '../../types/serviceRequest';

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
};

export type ConsultationCaseInput = {
  id: string;
  status: string;
  createdAt: string;
  progressPercent?: number | null;
  make?: string | null;
  model?: string | null;
  symptoms?: string | null;
  extracted?: { make?: string | null; model?: string | null; symptoms?: string | null } | null;
  serviceRequest?: { id: string; status: string } | null;
};

export type RequestCaseInput = {
  id: string;
  status: ServiceRequestStatus;
  createdAt: string;
  snapshotMake?: string | null;
  snapshotModel?: string | null;
  snapshotSymptoms?: string | null;
  consultationSessionId?: string;
  consultationSession?: {
    id?: string;
    status?: string;
    progressPercent?: number | null;
    diagnosis?: { urgency?: string } | null;
  } | null;
};

export type BookingCaseInput = {
  id: string;
  status: string;
  preferredAt: string;
  serviceRequest?: { id: string; status: string } | null;
};
