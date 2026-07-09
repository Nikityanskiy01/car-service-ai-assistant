export type ServiceRequestStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ServiceRequest {
  id: string;
  status: ServiceRequestStatus;
  version: number;
  createdAt: string;
  clientId?: string | null;
  snapshotMake?: string | null;
  snapshotModel?: string | null;
  snapshotSymptoms?: string | null;
  client?: { id?: string; fullName?: string | null; phone?: string | null; email?: string | null } | null;
  guestName?: string | null;
  guestPhone?: string | null;
}

export type ConsultationMessage = {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
};

export type DiagnosticRecommendation = {
  id: string;
  summary?: string | null;
  possibleCauses?: unknown;
  recommendedChecks?: unknown;
  urgency?: string | null;
  confidence?: number | null;
  estimatedPriceFrom?: number | null;
  canContinueDriving?: boolean | null;
  limitingFactors?: unknown;
  warning?: string | null;
  explanation?: string | null;
};

export type ServiceRequestDetail = ServiceRequest & {
  guestEmail?: string | null;
  consultationSessionId: string;
  consultationSession?: {
    id: string;
    status: string;
    progressPercent?: number | null;
    messages?: ConsultationMessage[];
    extracted?: Record<string, unknown> | null;
    recommendations?: DiagnosticRecommendation[] | null;
  };
};
