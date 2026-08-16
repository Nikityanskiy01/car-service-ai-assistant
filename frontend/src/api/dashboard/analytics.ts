import { api } from '../client';

export type AiFeedbackReport = {
  periodDays: number;
  totalFeedback: number;
  accuracyPercent: number;
  usefulPercent: number;
  byVerdict: { CORRECT: number; PARTIAL: number; INCORRECT: number };
  topMisdiagnoses: Array<{ actualCause: string; count: number }>;
  topErrorCategories: Array<{
    category: string;
    total: number;
    incorrect: number;
    partial: number;
    errorRatePercent: number;
  }>;
  recent: Array<{
    id: string;
    verdict: string;
    actualCause?: string | null;
    worksDone?: string | null;
    createdAt: string;
    category: string;
    vehicle?: string | null;
    managerName?: string | null;
  }>;
};

export function getAiFeedbackReport(days = 7) {
  return api<AiFeedbackReport>(`/analytics/ai-feedback?days=${days}`);
}

export type ManagerKpi = {
  periodDays: number;
  personal: {
    activeRequests: number;
    messagesSent: number;
    contactsConverted: number;
  };
  funnel: {
    consultationsTotal: number;
    requestsTotal: number;
    bookingsTotal: number;
    completedRequests: number;
    cancelledRequests: number;
    conversionConsultationToRequest: number;
    conversionRequestToBooking: number;
    conversionCompleted: number;
    steps: Array<{ key: string; label: string; count: number }>;
    biggestDropOff: { from: string; to: string; dropPercent: number } | null;
  };
};

export function getManagerKpi(days = 7) {
  return api<ManagerKpi>(`/analytics/manager-kpi?days=${days}`);
}

export type ActivityItem = {
  id: string;
  type: 'REQUEST_CREATED' | 'MESSAGE_SENT' | 'FEEDBACK_SAVED' | 'CONTACT_CONVERTED' | 'CRM_EXPORTED' | 'CRM_FAILED';
  at: string;
  title: string;
  requestId?: string | null;
};

export function listRequestActivity(limit = 15) {
  return api<{ items: ActivityItem[] }>(`/service-requests/activity?limit=${limit}`);
}
