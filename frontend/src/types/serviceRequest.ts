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
  assignedManagerId?: string | null;
  assignedManager?: { id: string; fullName: string } | null;
  firstResponseAt?: string | null;
  slaBreached?: boolean;
  consultationSession?: {
    feedback?: { id: string; verdict?: ConsultationFeedbackVerdict } | null;
    flowState?: { diagnosis?: ConsultationDiagnosis } | null;
    confidencePercent?: number | null;
    diagnosis?: ConsultationDiagnosis | null;
  } | null;
}

export type ConsultationMessage = {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
};

export type DiagnosticRecommendation = {
  id: string;
  title?: string;
  probabilityPercent?: number;
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

export type ConsultationFeedbackVerdict = 'CORRECT' | 'PARTIAL' | 'INCORRECT';

export type ConsultationFeedback = {
  id: string;
  verdict: ConsultationFeedbackVerdict;
  actualCause?: string | null;
  worksDone?: string | null;
  repairAmountMinor?: number | null;
  workOrderNumber?: string | null;
  repairCompletedAt?: string | null;
  repairMileageKm?: number | null;
  workCategory?: string | null;
  createdAt: string;
  updatedAt: string;
  manager?: { id: string; fullName: string };
};

export type ConsultationDiagnosis = {
  summary?: string;
  urgency?: string;
  confidence?: number | null;
  estimated_cost_from?: number | null;
  recommended_checks?: string[];
  probable_causes?: string[];
};

export type ServiceRequestDetail = ServiceRequest & {
  guestEmail?: string | null;
  consultationSessionId: string;
  bookings?: Array<{ id: string; status: string; preferredAt: string; notes?: string | null }>;
  consultationSession?: {
    id: string;
    status: string;
    progressPercent?: number | null;
    messages?: ConsultationMessage[];
    extracted?: Record<string, unknown> | null;
    recommendations?: DiagnosticRecommendation[] | null;
    diagnosis?: ConsultationDiagnosis | null;
    feedback?: ConsultationFeedback | null;
    flowState?: {
      stage?: string | null;
      photo_observations?: import('./consultation').PhotoObservations | null;
      diagnosis?: ConsultationDiagnosis | null;
    } | null;
  };
};

