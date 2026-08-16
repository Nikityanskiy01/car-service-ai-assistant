import { useCallback, useEffect } from 'react';
import { listContacts, listServiceRequests } from '../api/dashboard';
import { useDashboardPolling } from './useDashboardPolling';

export function useManagerNavBadges(enabled: boolean, setBadges: (badges: Record<string, number>) => void) {
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [fresh, sla, contacts, pendingFeedback] = await Promise.all([
        listServiceRequests({ status: 'NEW', pageSize: 1 }),
        listServiceRequests({ sla: 'breached', pageSize: 1 }),
        listContacts('NEW'),
        listServiceRequests({ feedback: 'none', pageSize: 1 }),
      ]);
      setBadges({
        requests: (fresh.total || 0) + (sla.total || 0),
        contacts: contacts.length,
        'ai-quality': pendingFeedback.total || 0,
      });
    } catch {
      /* бейджи не должны ломать кабинет */
    }
  }, [enabled, setBadges]);

  useEffect(() => {
    void load();
  }, [load]);

  useDashboardPolling(() => void load(), 60_000);
}
