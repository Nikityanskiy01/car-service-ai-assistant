import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminNavGroups } from '../config/dashboardNav';
import { useAdminPermission } from './useAdminPermission';
import { permissionForPath } from '../config/adminPermissions';

export type CommandItem = {
  id: string;
  label: string;
  group: string;
  to: string;
  keywords?: string;
};

function buildCommandItems(): CommandItem[] {
  const items: CommandItem[] = [];
  for (const group of adminNavGroups) {
    for (const item of group.items) {
      items.push({
        id: item.id,
        label: item.label,
        group: group.title,
        to: item.to,
        keywords: `${item.label} ${group.title}`.toLowerCase(),
      });
    }
  }
  items.push(
    { id: 'cmd-analytics-funnel', label: 'Воронка', group: 'Быстрые', to: '/dashboard/admin/analytics?tab=funnel', keywords: 'funnel воронка' },
    { id: 'cmd-conflicts', label: 'Конфликты CRM', group: 'Быстрые', to: '/dashboard/admin/integrations/conflicts', keywords: 'crm conflicts' },
    { id: 'cmd-export', label: 'Экспорт отчётов', group: 'Быстрые', to: '/dashboard/admin/analytics?tab=export', keywords: 'csv export' },
  );
  return items;
}

const ALL_ITEMS = buildCommandItems();

export function useAdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const canViewAnalytics = useAdminPermission('analytics.view');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const items = useMemo(() => {
    const permitted = ALL_ITEMS.filter((item) => {
      const perm = permissionForPath(item.to.split('?')[0]);
      if (!perm) return true;
      if (perm === 'analytics.view' && !canViewAnalytics) return false;
      return true;
    });
    const q = query.trim().toLowerCase();
    if (!q) return permitted;
    return permitted.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.keywords?.includes(q),
    );
  }, [query, canViewAnalytics]);

  function select(item: CommandItem) {
    setOpen(false);
    setQuery('');
    navigate(item.to);
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  return { open, setOpen, query, setQuery, items, select, close };
}
