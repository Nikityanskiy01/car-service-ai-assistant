import { api } from '../client';

export type FollowUpAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export type FollowUpMessage = {
  id: string;
  body: string;
  createdAt: string;
  author?: { id?: string; fullName?: string; role?: string };
  attachments?: FollowUpAttachment[];
  deliveryStatus?: 'sent' | 'read' | null;
};

export function listRequestMessages(requestId: string) {
  return api<FollowUpMessage[]>(`/service-requests/${requestId}/messages`);
}

export function sendRequestMessage(
  requestId: string,
  payload: { body?: string; attachments?: Array<{ fileName: string; mimeType: string; contentBase64: string }> },
) {
  return api<FollowUpMessage>(`/service-requests/${requestId}/messages`, {
    method: 'POST',
    body: payload,
  });
}

export type ConsultationFeedbackInput = {
  verdict: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
  actualCause?: string;
  worksDone?: string;
  repairAmountMinor?: number | null;
  workOrderNumber?: string | null;
  repairCompletedAt?: string | null;
  repairMileageKm?: number | null;
  workCategory?: string | null;
};

export type ConsultationFeedbackRecord = {
  id: string;
  sessionId?: string;
  verdict: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
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

export function upsertConsultationFeedback(requestId: string, body: ConsultationFeedbackInput) {
  return api<ConsultationFeedbackRecord>(`/service-requests/${requestId}/consultation-feedback`, {
    method: 'PUT',
    body,
  });
}

export type CompletionDocumentKind = 'WORK_ORDER' | 'RECEIPT' | 'WARRANTY' | 'ACT' | 'OTHER';

export type CompletionDocument = {
  id: string;
  kind: CompletionDocumentKind;
  kindLabel: string;
  label?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: string; fullName: string };
  url: string;
};

export type CompletionDocumentUpload = {
  kind: CompletionDocumentKind;
  label?: string | null;
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

export function listCompletionDocuments(requestId: string) {
  return api<CompletionDocument[]>(`/service-requests/${requestId}/completion-documents`);
}

export function uploadCompletionDocument(requestId: string, body: CompletionDocumentUpload) {
  return api<CompletionDocument>(`/service-requests/${requestId}/completion-documents`, {
    method: 'POST',
    body,
  });
}

export function deleteCompletionDocument(requestId: string, documentId: string) {
  return api<{ ok: true }>(`/service-requests/${requestId}/completion-documents/${documentId}`, {
    method: 'DELETE',
  });
}
