export interface ConsultationMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT' | 'SYSTEM' | string;
  content: string;
  createdAt: string;
}

export interface ConsultationExtractedData {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  symptoms?: string | null;
  problemConditions?: string | null;
}

export interface ConsultationRecommendation {
  title?: string;
  summary?: string;
  probabilityPercent?: number;
  confidence?: number;
  urgency?: 'low' | 'medium' | 'high' | 'critical' | string;
  checks?: string[];
  costFromMinor?: number;
}

export interface ConsultationDiagnosisSnapshot {
  summary?: string | null;
  urgency?: 'low' | 'medium' | 'high' | 'critical' | string;
  confidence?: number | null;
  estimated_cost_from?: number | null;
  recommended_checks?: string[];
  status?: 'SUCCESS' | 'MANUAL_REVIEW_REQUIRED' | string;
  analysis_available?: boolean;
  reason?: string | null;
  disclaimer?: string | null;
  execution_meta?: {
    provider?: 'vsellm' | 'fallback' | 'mock' | string;
    model?: string | null;
    requestId?: string;
    startedAt?: string;
    completedAt?: string | null;
    durationMs?: number | null;
    attemptCount?: number;
    streamed?: boolean;
    status?: 'SUCCESS' | 'FAILED' | 'FALLBACK' | string;
    errorCode?: string | null;
  } | null;
}

export interface ConsultationFlowState {
  stage?: string | null;
}

export interface ConsultationDetail {
  id: string;
  status: string;
  progressPercent?: number;
  confidencePercent?: number | null;
  costFromMinor?: number | null;
  preliminaryNote?: string | null;
  messages: ConsultationMessage[];
  extracted?: ConsultationExtractedData | null;
  recommendations?: ConsultationRecommendation[];
  diagnosis?: ConsultationDiagnosisSnapshot | null;
  flowState?: ConsultationFlowState | null;
}
