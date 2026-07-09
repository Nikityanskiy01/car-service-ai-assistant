import { api } from './client';
import type {
  AdminUser,
  AnalyticsKpi,
  AuditEvent,
  ClientDossier,
  CmsItem,
  ContactSubmission,
  ServiceBooking,
} from '../types/dashboard';
import type { ServiceRequest, ServiceRequestDetail, ServiceRequestStatus } from '../types/serviceRequest';

export type RequestListParams = {
  status?: ServiceRequestStatus;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'client' | 'car' | 'status' | 'version';
  dir?: 'asc' | 'desc';
};

export function listServiceRequests(params: RequestListParams = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  if (params.sort) search.set('sort', params.sort);
  if (params.dir) search.set('dir', params.dir);
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

export function listContacts() {
  return api<ContactSubmission[]>('/contact');
}

export function getClientDossier(clientId: string) {
  return api<ClientDossier>(`/service-requests/client-dossier/${clientId}`);
}

export function listAdminUsers() {
  return api<AdminUser[]>('/admin/users');
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

export function listCmsItems() {
  return api<CmsItem[]>('/admin/site-items');
}

export function getAnalyticsKpi() {
  return api<AnalyticsKpi>('/analytics/kpi');
}

export function listAuditEvents() {
  return api<AuditEvent[]>('/admin/audit-events');
}

export type FollowUpMessage = {
  id: string;
  body: string;
  createdAt: string;
  author?: { fullName?: string };
};

export function listRequestMessages(requestId: string) {
  return api<FollowUpMessage[]>(`/service-requests/${requestId}/messages`);
}

export function sendRequestMessage(requestId: string, body: string) {
  return api<FollowUpMessage>(`/service-requests/${requestId}/messages`, {
    method: 'POST',
    body: { body },
  });
}
