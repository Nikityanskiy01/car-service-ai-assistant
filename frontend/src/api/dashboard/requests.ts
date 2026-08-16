import { api } from '../client';
import type { ClientDossier, GuestDossier } from '../../types/dashboard';
import type { ServiceRequest, ServiceRequestDetail, ServiceRequestStatus } from '../../types/serviceRequest';

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
  cursor?: string;
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
  if (params.cursor) search.set('cursor', params.cursor);
  const qs = search.toString() ? `?${search}` : '';
  return api<{ items: ServiceRequest[]; total: number; page: number; pageSize: number; nextCursor: string | null }>(
    `/service-requests${qs}`,
  );
}

export type RequestBoardColumn = {
  items: ServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
};

export type RequestBoard = {
  columns: Partial<Record<ServiceRequestStatus, RequestBoardColumn>>;
  total: number;
};

export function listServiceRequestBoard(params: Omit<RequestListParams, 'page'> = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.statuses) search.set('statuses', params.statuses);
  if (params.q) search.set('q', params.q);
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
  return api<RequestBoard>(`/service-requests/board${qs}`);
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

export function getClientDossier(clientId: string) {
  return api<ClientDossier>(`/service-requests/client-dossier/${clientId}`);
}

export function getGuestDossier(phone: string) {
  return api<GuestDossier>(`/service-requests/guest-dossier/${encodeURIComponent(phone)}`);
}

export type ManagerClientFilter = 'all' | 'active' | 'guests';
export type ManagerClientSort = 'activity' | 'recent' | 'name' | 'ltv';

export type ManagerClientVehicle = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  licensePlate?: string | null;
  vin?: string | null;
};

export type ManagerClientRow = {
  key: string;
  clientId?: string;
  guestPhone?: string;
  name: string;
  phone: string;
  email?: string;
  telegram?: string;
  city?: string;
  isGuest: boolean;
  totalRequests: number;
  activeRequests: number;
  lastActivityAt: string | null;
  vehicles?: ManagerClientVehicle[];
  ltvMinor?: number;
  nextBookingAt?: string | null;
};

export type ManagerClientCounts = {
  all: number;
  active: number;
  guests: number;
};

export function listClients(params: {
  q?: string;
  filter?: ManagerClientFilter;
  sort?: ManagerClientSort;
  page?: number;
  pageSize?: number;
} = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.filter) search.set('filter', params.filter);
  if (params.sort) search.set('sort', params.sort);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString() ? `?${search}` : '';
  return api<{
    items: ManagerClientRow[];
    total: number;
    page: number;
    pageSize: number;
    counts: ManagerClientCounts;
  }>(`/service-requests/clients${qs}`);
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
