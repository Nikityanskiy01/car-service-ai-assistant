import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminNavGroups, managerNavItems } from '../config/dashboardNav';
import { permissionForPath } from '../config/adminPermissions';
import { useAdminPermission } from './useAdminPermission';

export type CommandItem = {
  id: string;
  label: string;
  group: string;
  to: string;
  keywords?: string;
};

/** `null` — зона без палитры (кабинет клиента): хоткей не перехватывается. */
export type CommandZone = 'admin' | 'manager' | null;

function buildAdminItems(): CommandItem[] {
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
    {
      id: 'cmd-new-requests',
      label: 'Новые заявки',
      group: 'Быстрые',
      to: '/dashboard/admin/operations/requests?status=NEW',
      keywords: 'новые заявки new очередь',
    },
    {
      id: 'cmd-analytics-funnel',
      label: 'Воронка',
      group: 'Быстрые',
      to: '/dashboard/admin/analytics?tab=funnel',
      keywords: 'funnel воронка',
    },
    {
      id: 'cmd-conflicts',
      label: 'Конфликты CRM',
      group: 'Быстрые',
      to: '/dashboard/admin/integrations/conflicts',
      keywords: 'crm conflicts конфликты',
    },
    {
      id: 'cmd-export',
      label: 'Экспорт отчётов',
      group: 'Быстрые',
      to: '/dashboard/admin/analytics?tab=export',
      keywords: 'csv export экспорт',
    },
    {
      id: 'cmd-sessions',
      label: 'Активные сессии',
      group: 'Быстрые',
      to: '/dashboard/admin/security/sessions',
      keywords: 'sessions сессии logout выход',
    },
    {
      id: 'cmd-users',
      label: 'Пользователи и роли',
      group: 'Быстрые',
      to: '/dashboard/admin/team/users',
      keywords: 'users роли сотрудники менеджеры',
    },
  );
  return items;
}

function buildManagerItems(): CommandItem[] {
  const items: CommandItem[] = managerNavItems.map((item) => ({
    id: item.id,
    label: item.label,
    group: 'Разделы',
    to: item.to,
    keywords: `${item.label} ${item.to}`.toLowerCase(),
  }));

  items.push(
    {
      id: 'cmd-new-requests',
      label: 'Новые заявки',
      group: 'Очередь',
      to: '/dashboard/manager/requests?status=NEW',
      keywords: 'новые new заявки очередь',
    },
    {
      id: 'cmd-mine',
      label: 'Мои заявки',
      group: 'Очередь',
      to: '/dashboard/manager/requests?scope=mine',
      keywords: 'мои my assigned назначены',
    },
    {
      id: 'cmd-sla',
      label: 'Просроченные по SLA',
      group: 'Очередь',
      to: '/dashboard/manager/requests?sla=breached',
      keywords: 'sla просрочка breached горит',
    },
    {
      id: 'cmd-kanban',
      label: 'Канбан-доска',
      group: 'Очередь',
      to: '/dashboard/manager/requests?view=kanban',
      keywords: 'kanban канбан доска',
    },
    {
      id: 'cmd-feedback',
      label: 'Заявки без оценки ИИ',
      group: 'Очередь',
      to: '/dashboard/manager/requests?feedback=none',
      keywords: 'оценка feedback ии качество',
    },
    {
      id: 'cmd-today',
      label: 'Записи на сегодня',
      group: 'Календарь',
      to: '/dashboard/manager/calendar',
      keywords: 'сегодня записи календарь today',
    },
    {
      id: 'cmd-new-booking',
      label: 'Создать запись',
      group: 'Действия',
      to: '/booking',
      keywords: 'создать запись booking новая',
    },
    {
      id: 'cmd-consult',
      label: 'Открыть ИИ-консультацию',
      group: 'Действия',
      to: '/consult',
      keywords: 'консультация ии диагностика consult',
    },
  );

  return items;
}

const ADMIN_ITEMS = buildAdminItems();
const MANAGER_ITEMS = buildManagerItems();

export function useCommandPalette(zone: CommandZone) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const canViewAnalytics = useAdminPermission('analytics.view');

  useEffect(() => {
    if (!zone) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zone]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [zone]);

  const items = useMemo(() => {
    if (!zone) return [];
    const source = zone === 'admin' ? ADMIN_ITEMS : MANAGER_ITEMS;
    const permitted =
      zone === 'admin'
        ? source.filter((item) => {
            const perm = permissionForPath(item.to.split('?')[0]);
            if (!perm) return true;
            if (perm === 'analytics.view' && !canViewAnalytics) return false;
            return true;
          })
        : source;
    const q = query.trim().toLowerCase();
    if (!q) return permitted;
    return permitted.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.keywords?.includes(q),
    );
  }, [query, canViewAnalytics, zone]);

  const select = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery('');
      navigate(item.to);
    },
    [navigate],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  return { open, setOpen, query, setQuery, items, select, close };
}
