import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Cog,
  FileText,
  Home,
  LayoutDashboard,
  Link2,
  Palette,
  Plug,
  Users,
} from 'lucide-react';

export type DashboardNavItem = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number;
  group?: string;
};

export const managerNavItems: DashboardNavItem[] = [
  { id: 'desk', label: 'Рабочий стол', to: '/dashboard/manager', icon: LayoutDashboard, group: 'Работа' },
  { id: 'requests', label: 'Заявки', to: '/dashboard/manager/requests', icon: ClipboardList, group: 'Работа' },
  { id: 'calendar', label: 'Календарь', to: '/dashboard/manager/calendar', icon: CalendarDays, group: 'Работа' },
  { id: 'clients', label: 'Клиенты', to: '/dashboard/manager/clients', icon: Users, group: 'Работа' },
  { id: 'contacts', label: 'Обращения с сайта', to: '/dashboard/manager/contacts', icon: Bell, group: 'Работа' },
];

export const adminNavGroups: Array<{ title: string; items: DashboardNavItem[] }> = [
  {
    title: 'Обзор',
    items: [
      { id: 'overview', label: 'Рабочий стол', to: '/dashboard/admin', icon: LayoutDashboard },
      { id: 'analytics', label: 'Аналитика', to: '/dashboard/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Пользователи',
    items: [
      { id: 'users', label: 'Сотрудники и клиенты', to: '/dashboard/admin/users', icon: Users },
    ],
  },
  {
    title: 'Сайт',
    items: [
      { id: 'cms', label: 'Содержимое сайта', to: '/dashboard/admin/content', icon: FileText },
      { id: 'appearance', label: 'Оформление', to: '/dashboard/admin/appearance', icon: Palette },
    ],
  },
  {
    title: 'Работа сервиса',
    items: [
      { id: 'requests', label: 'Заявки', to: '/dashboard/admin/requests', icon: ClipboardList },
      { id: 'bookings', label: 'Записи', to: '/dashboard/admin/bookings', icon: CalendarDays },
    ],
  },
  {
    title: 'Интеграции',
    items: [
      { id: 'integrations', label: 'Подключения', to: '/dashboard/admin/integrations', icon: Plug },
      { id: 'integration-jobs', label: 'Очередь', to: '/dashboard/admin/integrations/jobs', icon: Link2 },
    ],
  },
  {
    title: 'Система',
    items: [
      { id: 'audit', label: 'Журнал действий', to: '/dashboard/admin/audit', icon: Cog },
      { id: 'home', label: 'На сайт', to: '/', icon: Home },
    ],
  },
];

export const adminQuickActions = [
  { label: 'Добавить сотрудника', to: '/dashboard/admin/users' },
  { label: 'Подключить CRM', to: '/dashboard/admin/integrations' },
  { label: 'Аналитика', to: '/dashboard/admin/analytics' },
];

export const managerQuickActions = [
  { label: 'Все заявки', to: '/dashboard/manager/requests' },
  { label: 'Календарь', to: '/dashboard/manager/calendar' },
  { label: 'Новая консультация', to: '/consult' },
];
