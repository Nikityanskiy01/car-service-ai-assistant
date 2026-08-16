import { api } from '../client';
import type { AdminUser, AnalyticsKpi, AuditEvent } from '../../types/dashboard';
import type { ActiveSessionItem } from './security';

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

export type AdminSessionItem = ActiveSessionItem & {
  user: Pick<AdminUser, 'id' | 'email' | 'fullName' | 'role' | 'blocked'>;
};

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
