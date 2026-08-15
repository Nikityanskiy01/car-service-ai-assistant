import { api } from './client';
import type {
  AdminUser,
  AnalyticsKpi,
  AuditEvent,
  ClientDossier,
  ContactSubmission,
  GuestDossier,
  ServiceBooking,
} from '../types/dashboard';
import type { ServiceRequest, ServiceRequestDetail, ServiceRequestStatus } from '../types/serviceRequest';

export type RequestListParams = {
  status?: ServiceRequestStatus;
  statuses?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'client' | 'car' | 'status' | 'version';
  dir?: 'asc' | 'desc';
  mine?: boolean | string;
  sla?: 'breached';
  feedback?: 'none' | 'CORRECT' | 'PARTIAL' | 'INCORRECT';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  source?: 'guest' | 'registered' | 'contact';
  period?: 'today' | '7d' | 'all';
  hasDiagnosis?: boolean | string;
};

export function listServiceRequests(params: RequestListParams = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.statuses) search.set('statuses', params.statuses);
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.sort) search.set('sort', params.sort);
  if (params.dir) search.set('dir', params.dir);
  if (params.mine) search.set('mine', 'true');
  if (params.sla) search.set('sla', params.sla);
  if (params.feedback) search.set('feedback', params.feedback);
  if (params.urgency) search.set('urgency', params.urgency);
  if (params.source) search.set('source', params.source);
  if (params.period) search.set('period', params.period);
  if (params.hasDiagnosis != null && params.hasDiagnosis !== '') {
    search.set('hasDiagnosis', String(params.hasDiagnosis));
  }
  const qs = search.toString() ? `?${search}` : '';
  return api<{ items: ServiceRequest[]; total: number; page: number; pageSize: number }>(
    `/service-requests${qs}`,
  );
}

export function getServiceRequest(id: string) {
  return api<ServiceRequestDetail>(`/service-requests/${id}`);
}

export function patchServiceRequestStatus(id: string, status: ServiceRequestStatus, expectedVersion: number) {
  return api<{ id: string; status: ServiceRequestStatus; version: number }>(`/service-requests/${id}`, {
    method: 'PATCH',
    body: { status, expectedVersion },
  });
}

export function listBookings() {
  return api<ServiceBooking[]>('/bookings');
}

export function getBooking(bookingId: string) {
  return api<ServiceBooking>(`/bookings/${bookingId}`);
}

export function cancelBooking(bookingId: string) {
  return api<ServiceBooking>(`/bookings/${bookingId}`, {
    method: 'PATCH',
    body: { status: 'CANCELLED' },
  });
}

export function rescheduleBooking(bookingId: string, preferredAt: string) {
  return api<ServiceBooking>(`/bookings/${bookingId}`, {
    method: 'PATCH',
    body: { preferredAt },
  });
}

export function patchBooking(
  bookingId: string,
  body: {
    status?: 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED';
    preferredAt?: string;
    notes?: string | null;
  },
) {
  return api<ServiceBooking>(`/bookings/${bookingId}`, { method: 'PATCH', body });
}

export function listContacts(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return api<ContactSubmission[]>(`/contact${qs}`);
}

export function patchContactStatus(
  contactId: string,
  body: { status: 'NEW' | 'IN_PROGRESS' | 'CLOSED'; closedReason?: string },
) {
  return api<ContactSubmission>(`/contact/${contactId}`, { method: 'PATCH', body });
}

export function convertContactToRequest(contactId: string) {
  return api<{ requestId: string; alreadyConverted?: boolean }>(`/contact/${contactId}/convert-to-request`, {
    method: 'POST',
    body: {},
  });
}

export function getClientDossier(clientId: string) {
  return api<ClientDossier>(`/service-requests/client-dossier/${clientId}`);
}

export function getGuestDossier(phone: string) {
  return api<GuestDossier>(`/service-requests/guest-dossier/${encodeURIComponent(phone)}`);
}

export function assignRequestToMe(requestId: string) {
  return api<{
    id: string;
    assignedManagerId: string;
    assignedManager?: { id: string; fullName: string };
    version: number;
  }>(`/service-requests/${requestId}/assign-to-me`, { method: 'POST', body: {} });
}

export function assignRequestToManager(requestId: string, managerId: string) {
  return api<{
    id: string;
    assignedManagerId: string;
    assignedManager?: { id: string; fullName: string };
    version: number;
  }>(`/service-requests/${requestId}/assign-manager`, {
    method: 'PATCH',
    body: { managerId },
  });
}

export function listStaffManagers() {
  return api<{ items: Array<{ id: string; fullName: string; email?: string; role: string }> }>(
    '/service-requests/managers',
  );
}

export function listAdminUsers(params?: { q?: string; role?: string; blocked?: boolean }) {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.role) search.set('role', params.role);
  if (params?.blocked === true) search.set('blocked', 'true');
  if (params?.blocked === false) search.set('blocked', 'false');
  const qs = search.toString() ? `?${search}` : '';
  return api<AdminUser[]>(`/admin/users${qs}`);
}

export function patchUserRole(userId: string, role: AdminUser['role']) {
  return api(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } });
}

export function blockUser(userId: string) {
  return api(`/admin/users/${userId}/block`, { method: 'POST', body: {} });
}

export function unblockUser(userId: string) {
  return api(`/admin/users/${userId}/unblock`, { method: 'POST', body: {} });
}

export function revokeUserSessions(userId: string) {
  return api<{ ok: true; revoked: number }>(`/admin/users/${userId}/revoke-sessions`, {
    method: 'POST',
    body: {},
  });
}

export function listAdminSessions() {
  return api<AdminSessionItem[]>('/admin/sessions');
}

export function revokeAdminSession(sessionId: string) {
  return api<{ ok: true; userId: string }>(`/admin/sessions/${sessionId}`, { method: 'DELETE' });
}

export function getAnalyticsKpi(days?: number) {
  const qs = days != null ? `?days=${days}` : '';
  return api<AnalyticsKpi>(`/analytics/kpi${qs}`);
}

export type LlmStatus = {
  enabled: boolean;
  provider: string;
  fallbackEnabled: boolean;
  fallbackProvider?: string | null;
  models: { main: string; extraction: string; diagnosis: string; embedding: string; vision?: string };
  state: 'disabled' | 'ok' | 'degraded' | 'unavailable';
  message?: string;
  checkedAt?: string;
  metrics?: {
    totalCalls: number;
    successes: number;
    failures: number;
    fallbacks: number;
    validationFailures: number;
    cacheHits: number;
    circuitOpenRejections: number;
    successRatePercent: number;
    fallbackRatePercent: number;
    latencyMs: { p50: number | null; p95: number | null; last: number | null; samples: number };
    lastError?: string | null;
  };
  circuitBreaker?: {
    enabled: boolean;
    state: string;
    failures: number;
    threshold: number;
  };
  diagnosisCache?: { enabled: boolean; size: number; maxEntries: number };
  diagnosisQueue?: { mode: string; concurrency: number; active: number; pending: number };
  probe?: {
    ok: boolean;
    model?: string;
    durationMs?: number;
    replyPreview?: string;
    error?: string;
  } | null;
};

export function getLlmStatus(probe = false) {
  const qs = probe ? '?probe=true' : '';
  return api<LlmStatus>(`/admin/llm-status${qs}`);
}

export function listAuditEvents(params?: {
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.action) search.set('action', params.action);
  if (params?.entityType) search.set('entityType', params.entityType);
  if (params?.actorId) search.set('actorId', params.actorId);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString() ? `?${search}` : '';
  return api<AuditEvent[]>(`/admin/audit-events${qs}`);
}

export type BookingAuditEntry = {
  id: string;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
  changes: Record<string, { from: unknown; to: unknown }>;
};

export function getBookingAudit(bookingId: string) {
  return api<BookingAuditEntry[]>(`/bookings/${bookingId}/audit`);
}

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

export type UserProfile = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role: string;
  emailProfile?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  telegram?: string | null;
  preferredContact?: import('../types/auth').PreferredContact | null;
  createdAt?: string | null;
};

export function getProfile() {
  return api<UserProfile>('/users/me');
}

export function getClientDashboardSummary() {
  return api<import('../features/client-cases/resolveClientHero').ClientDashboardSummary>(
    '/users/me/summary',
  );
}

export function patchProfile(body: {
  fullName?: string;
  phone?: string;
  emailProfile?: string | null;
  city?: string | null;
  telegram?: string | null;
  preferredContact?: import('../types/auth').PreferredContact | null;
}) {
  return api<UserProfile>('/users/me', { method: 'PATCH', body });
}

export function uploadAvatar(body: { mimeType: string; contentBase64: string }) {
  return api<UserProfile>('/users/me/avatar', { method: 'POST', body });
}

export function removeAvatar() {
  return api<UserProfile>('/users/me/avatar', { method: 'DELETE' });
}

export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return api<{ ok: true; user?: import('../types/auth').AuthUser }>('/users/me/password', {
    method: 'POST',
    body,
  });
}

export type LoginHistoryItem = {
  id: string;
  success: boolean;
  method: string;
  methodLabel?: string;
  ip: string | null;
  ipLabel?: string | null;
  ipKind?: string | null;
  userAgent: string | null;
  device?: import('../lib/clientMeta').ClientDeviceMeta;
  reason: string | null;
  reasonLabel?: string | null;
  createdAt: string;
};

export type ActiveSessionItem = {
  id: string;
  current: boolean;
  device?: import('../lib/clientMeta').ClientDeviceMeta;
  ip: string | null;
  ipLabel?: string | null;
  ipKind?: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export type AdminSessionItem = ActiveSessionItem & {
  user: Pick<AdminUser, 'id' | 'email' | 'fullName' | 'role' | 'blocked'>;
};

export type SecurityOverview = {
  totpEnabled: boolean;
  totpEnabledAt: string | null;
  backupRemaining: number;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  telegram: string | null;
  telegramLinked: boolean;
  telegramLinkedAt: string | null;
  telegramBotUsername: string | null;
  loginMethods: {
    password: boolean;
    emailOtp: boolean;
    sms: boolean;
    telegram: boolean;
  };
  channels: {
    emailConfigured: boolean;
    smsConfigured: boolean;
    telegramConfigured: boolean;
  };
  history: LoginHistoryItem[];
  sessions: ActiveSessionItem[];
};

export type TotpSetupPayload = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  issuer: string;
  account: string;
  backupCodes: string[];
};

export function getSecurityOverview() {
  return api<SecurityOverview>('/users/me/security');
}

export function exportMyData() {
  return api<Record<string, unknown>>('/users/me/privacy/export');
}

export function deleteMyAccount(body: { password: string; code?: string }) {
  return api<{ ok: true }>('/users/me/privacy/delete', { method: 'POST', body });
}

export function startTotpSetup() {
  return api<TotpSetupPayload>('/users/me/2fa/setup', { method: 'POST', body: {} });
}

export function confirmTotpSetup(code: string) {
  return api<{ ok: true; backupCodes: string[]; totpSetupPending?: boolean; user?: import('../types/auth').AuthUser }>(
    '/users/me/2fa/confirm',
    {
      method: 'POST',
      body: { code },
    },
  );
}

export function abortTotpSetup() {
  return api<{ ok: true }>('/users/me/2fa/setup/cancel', { method: 'POST', body: {} });
}

export function regenerateBackupCodes(body: { password: string; code: string }) {
  return api<{ ok: true; backupCodes: string[] }>('/users/me/2fa/backup-codes', {
    method: 'POST',
    body,
  });
}

export function disableTotp(body: { password: string; code: string; confirmPhrase: string }) {
  return api<{ ok: true }>('/users/me/2fa/disable', { method: 'POST', body });
}

export type SessionRevokeScope = 'one' | 'others';

export type SessionRevokeChallenge = {
  scope: SessionRevokeScope;
  targetLabel: string;
  destinationHint: string;
  expiresInSec: number;
  resendAfterSec: number;
};

export function startSessionRevoke(body: { scope: SessionRevokeScope; sessionId?: string }) {
  return api<SessionRevokeChallenge>('/users/me/sessions/revoke/start', {
    method: 'POST',
    body,
  });
}

export function revokeSession(sessionId: string, code: string) {
  return api<{ ok: true; currentRevoked?: boolean }>(`/users/me/sessions/${sessionId}`, {
    method: 'DELETE',
    body: { code },
  });
}

export function revokeOtherSessions(code: string) {
  return api<{ ok: true; revoked: number }>('/users/me/sessions/revoke-others', {
    method: 'POST',
    body: { code },
  });
}

export type PhoneVerifyStart = {
  alreadyVerified?: boolean;
  challengeToken?: string;
  destinationHint?: string;
  expiresInSec?: number;
  resendAfterSec?: number;
};

export type TelegramLinkStart = {
  alreadyLinked?: boolean;
  code?: string;
  botUsername?: string | null;
  deepLink?: string | null;
  expiresInSec?: number;
  resendAfterSec?: number;
};

export function startPhoneVerification() {
  return api<PhoneVerifyStart>('/users/me/phone/verify/start', { method: 'POST', body: {} });
}

export function confirmPhoneVerification(code: string) {
  return api<{ ok: true; phoneVerified: boolean }>('/users/me/phone/verify/confirm', {
    method: 'POST',
    body: { code },
  });
}

export function startTelegramLink() {
  return api<TelegramLinkStart>('/users/me/telegram/link/start', { method: 'POST', body: {} });
}

export type SensitiveActionVerification = {
  password: string;
  code?: string;
};

export function unlinkTelegram(body: SensitiveActionVerification) {
  return api<{ ok: true }>('/users/me/telegram/unlink', { method: 'POST', body });
}

export function updateLoginMethods(body: {
  loginEmailOtpEnabled?: boolean;
  loginSmsEnabled?: boolean;
  loginTelegramEnabled?: boolean;
  password?: string;
  code?: string;
}) {
  return api<{ ok: true }>('/users/me/login-methods', { method: 'POST', body });
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

export function bulkPatchRequestStatuses(ids: string[], status: ServiceRequestStatus) {
  return api<{ updated: number }>('/service-requests/bulk/status', {
    method: 'POST',
    body: { ids, status },
  });
}

export function bulkAssignRequests(ids: string[], managerId?: string) {
  return api<{ updated: number }>('/service-requests/bulk/assign', {
    method: 'POST',
    body: { ids, managerId },
  });
}

export function bulkExportRequestsToCrm(ids: string[], connectionId?: string) {
  return api<{ exported: number; failed: number; errors: Array<{ id: string; message: string }> }>(
    '/service-requests/bulk/export-crm',
    { method: 'POST', body: { ids, connectionId } },
  );
}

export type StatusHistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  actor?: { id: string; fullName: string } | null;
};

export function getRequestStatusHistory(requestId: string) {
  return api<{ items: StatusHistoryItem[] }>(`/service-requests/${requestId}/status-history`);
}

export type SimilarCase = {
  make?: string | null;
  model?: string | null;
  symptomCategory?: string | null;
  topRecommendations?: string[];
  costFromMinor?: number | null;
};

export function getSimilarCases(requestId: string) {
  return api<{ items: SimilarCase[] }>(`/service-requests/${requestId}/similar-cases`);
}
