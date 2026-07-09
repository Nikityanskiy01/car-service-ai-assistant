import { api } from './client';
import type {
  ConnectionTestResult,
  IntegrationCapabilities,
  IntegrationConflict,
  IntegrationConnection,
  IntegrationJob,
  IntegrationProvider,
  RequestIntegrationStatus,
} from '../types/integration';

export function listIntegrations(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return api<IntegrationConnection[]>(`/admin/integrations${qs}`);
}

export function getIntegration(id: string) {
  return api<IntegrationConnection>(`/admin/integrations/${id}`);
}

export function createIntegration(body: {
  name: string;
  provider: IntegrationProvider;
  versionLabel?: string;
  mode?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, string>;
}) {
  return api<IntegrationConnection>('/admin/integrations', { method: 'POST', body });
}

export function patchIntegration(
  id: string,
  body: Partial<{
    name: string;
    versionLabel: string | null;
    mode: string;
    config: Record<string, unknown>;
    credentials: Record<string, string>;
  }>,
) {
  return api<IntegrationConnection>(`/admin/integrations/${id}`, { method: 'PATCH', body });
}

export function deleteIntegration(id: string) {
  return api<void>(`/admin/integrations/${id}`, { method: 'DELETE' });
}

export function testIntegration(id: string) {
  return api<ConnectionTestResult>(`/admin/integrations/${id}/test`, { method: 'POST', body: {} });
}

export function enableIntegration(id: string) {
  return api<IntegrationConnection>(`/admin/integrations/${id}/enable`, { method: 'POST', body: {} });
}

export function disableIntegration(id: string) {
  return api<IntegrationConnection>(`/admin/integrations/${id}/disable`, { method: 'POST', body: {} });
}

export function syncIntegration(id: string) {
  return api<{ dispatched: number; processed: number }>(`/admin/integrations/${id}/sync`, {
    method: 'POST',
    body: {},
  });
}

export function getIntegrationCapabilities(id: string) {
  return api<IntegrationCapabilities>(`/admin/integrations/${id}/capabilities`);
}

export function listIntegrationJobs(id: string, params?: { status?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.page) search.set('page', String(params.page));
  if (params?.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString() ? `?${search}` : '';
  return api<{ items: IntegrationJob[]; total: number; page: number; pageSize: number }>(
    `/admin/integrations/${id}/jobs${qs}`,
  );
}

export function listIntegrationConflicts(id: string) {
  return api<IntegrationConflict[]>(`/admin/integrations/${id}/conflicts`);
}

export function retryIntegrationJob(jobId: string) {
  return api<IntegrationJob>(`/admin/integration-jobs/${jobId}/retry`, { method: 'POST', body: {} });
}

export function cancelIntegrationJob(jobId: string) {
  return api<void>(`/admin/integration-jobs/${jobId}/cancel`, { method: 'POST', body: {} });
}

export function resolveIntegrationConflict(
  conflictId: string,
  resolution: 'KEEP_LOCAL' | 'ACCEPT_EXTERNAL' | 'MERGE' | 'POSTPONE',
  note?: string,
) {
  return api(`/admin/integration-conflicts/${conflictId}/resolve`, {
    method: 'POST',
    body: { resolution, note },
  });
}

export function getRequestIntegrations(requestId: string) {
  return api<RequestIntegrationStatus>(`/manager/requests/${requestId}/integrations`);
}

export function exportRequestToCrm(requestId: string, connectionId: string) {
  return api<RequestIntegrationStatus>(`/manager/requests/${requestId}/export`, {
    method: 'POST',
    body: { connectionId },
  });
}

export function retryRequestIntegration(requestId: string, connectionId: string) {
  return api<RequestIntegrationStatus>(`/manager/requests/${requestId}/integrations/${connectionId}/retry`, {
    method: 'POST',
    body: {},
  });
}
