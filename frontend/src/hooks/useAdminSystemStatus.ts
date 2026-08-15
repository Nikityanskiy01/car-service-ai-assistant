import { useCallback, useEffect, useState } from 'react';
import { getLlmStatus, listServiceRequests } from '../api/dashboard';
import { listIntegrationJobs, listIntegrations } from '../api/integrations';
import type { LlmStatus } from '../api/dashboard';

export type AdminSystemStatus = {
  llm: LlmStatus | null;
  integrationIssues: number;
  failedJobs: number;
  newRequests: number;
  loading: boolean;
};

const FAILED_JOB_STATUSES = new Set(['FAILED', 'DEAD_LETTER', 'RETRYING']);
const POLL_MS = 45_000;

export function useAdminSystemStatus(enabled = true) {
  const [status, setStatus] = useState<AdminSystemStatus>({
    llm: null,
    integrationIssues: 0,
    failedJobs: 0,
    newRequests: 0,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [llm, integrations, requests] = await Promise.all([
        getLlmStatus(false),
        listIntegrations(),
        listServiceRequests({ status: 'NEW', pageSize: 1 }),
      ]);

      const integrationIssues = integrations.filter(
        (x) => x.status === 'AUTH_ERROR' || x.status === 'UNAVAILABLE',
      ).length;

      let failedJobs = 0;
      if (integrations.length) {
        const jobResults = await Promise.all(
          integrations.map((c) =>
            listIntegrationJobs(c.id, { status: 'FAILED', pageSize: 1 }).catch(() => ({ total: 0, items: [] })),
          ),
        );
        failedJobs = jobResults.reduce((sum, r) => sum + (r.total || 0), 0);

        if (!failedJobs) {
          const allRecent = await Promise.all(
            integrations.slice(0, 3).map((c) =>
              listIntegrationJobs(c.id, { pageSize: 20 }).catch(() => ({ items: [], total: 0 })),
            ),
          );
          failedJobs = allRecent
            .flatMap((r) => r.items)
            .filter((j) => FAILED_JOB_STATUSES.has(j.status)).length;
        }
      }

      setStatus({
        llm,
        integrationIssues,
        failedJobs,
        newRequests: requests.total,
        loading: false,
      });
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { ...status, refresh };
}
