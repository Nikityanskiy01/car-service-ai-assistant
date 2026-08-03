import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Palette,
  Plug,
  ScrollText,
  Settings2,
  Shield,
  Sparkles,
  User,
  Users,
  Wrench,
} from 'lucide-react';

export type DashboardNavItem = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number;
  group?: string;
};

export const clientNavItems: DashboardNavItem[] = [
  { id: 'client-home', label: 'Обзор', to: '/dashboard/client', icon: LayoutDashboard, group: 'Кабинет' },
  { id: 'client-cases', label: 'Мои обращения', to: '/dashboard/client/cases', icon: ClipboardList, group: 'Кабинет' },
  { id: 'client-bookings', label: 'Записи', to: '/dashboard/client/bookings', icon: CalendarDays, group: 'Кабинет' },
  { id: 'client-vehicles', label: 'Мои автомобили', to: '/dashboard/client/vehicles', icon: Car, group: 'Кабинет' },
  { id: 'client-profile', label: 'Профиль', to: '/dashboard/client/profile', icon: User, group: 'Кабинет' },
  { id: 'client-consult', label: 'ИИ-диагностика', to: '/consult', icon: Wrench },
];

export const managerNavItems: DashboardNavItem[] = [
  { id: 'desk', label: 'Рабочий стол', to: '/dashboard/manager', icon: LayoutDashboard, group: 'Работа' },
  { id: 'requests', label: 'Очередь', to: '/dashboard/manager/requests', icon: ClipboardList, group: 'Работа' },
  { id: 'calendar', label: 'Календарь', to: '/dashboard/manager/calendar', icon: CalendarDays, group: 'Работа' },
  { id: 'clients', label: 'Клиенты', to: '/dashboard/manager/clients', icon: Users, group: 'Работа' },
  { id: 'contacts', label: 'Входящие', to: '/dashboard/manager/contacts', icon: Bell, group: 'Работа' },
  { id: 'ai-quality', label: 'Качество ИИ', to: '/dashboard/manager/ai-quality', icon: BrainCircuit, group: 'Работа' },
];

export const adminNavGroups: Array<{ title: string; items: DashboardNavItem[] }> = [
  {
    title: 'Пульт',
    items: [
      { id: 'command', label: 'Пульт', to: '/dashboard/admin', icon: Gauge },
      { id: 'analytics', label: 'Аналитика', to: '/dashboard/admin/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Операции',
    items: [
      { id: 'ops-requests', label: 'Заявки', to: '/dashboard/admin/operations/requests', icon: ClipboardList },
      { id: 'ops-bookings', label: 'Записи', to: '/dashboard/admin/operations/bookings', icon: CalendarDays },
      { id: 'ops-clients', label: 'Клиенты', to: '/dashboard/admin/operations/clients', icon: Users },
      { id: 'ops-contacts', label: 'Обращения', to: '/dashboard/admin/operations/contacts', icon: Bell },
    ],
  },
  {
    title: 'Команда',
    items: [
      { id: 'team-users', label: 'Пользователи', to: '/dashboard/admin/team/users', icon: Users },
      { id: 'team-activity', label: 'Активность', to: '/dashboard/admin/team/activity', icon: Activity },
    ],
  },
  {
    title: 'ИИ-студия',
    items: [
      { id: 'ai-status', label: 'Статус и модели', to: '/dashboard/admin/ai/status', icon: BrainCircuit },
      { id: 'ai-scenarios', label: 'Сценарии', to: '/dashboard/admin/ai/scenarios', icon: Sparkles },
      { id: 'ai-reference', label: 'Справочники', to: '/dashboard/admin/ai/reference', icon: BookOpen },
      { id: 'ai-memory', label: 'Память кейсов', to: '/dashboard/admin/ai/memory', icon: GitBranch },
      { id: 'ai-feedback', label: 'Обратная связь', to: '/dashboard/admin/ai/feedback', icon: MessageSquare },
    ],
  },
  {
    title: 'Сайт и бренд',
    items: [
      { id: 'site-items', label: 'Услуги и галерея', to: '/dashboard/admin/site/items', icon: FileText },
      { id: 'site-blocks', label: 'Текстовые блоки', to: '/dashboard/admin/site/blocks', icon: ScrollText },
      { id: 'site-appearance', label: 'Оформление', to: '/dashboard/admin/site/appearance', icon: Palette },
      { id: 'site-legal', label: 'Юридические данные', to: '/dashboard/admin/site/legal', icon: Shield },
    ],
  },
  {
    title: 'Интеграции',
    items: [
      { id: 'integrations', label: 'Подключения', to: '/dashboard/admin/integrations', icon: Plug },
      { id: 'integration-jobs', label: 'Очередь', to: '/dashboard/admin/integrations/jobs', icon: Link2 },
      { id: 'integration-conflicts', label: 'Конфликты', to: '/dashboard/admin/integrations/conflicts', icon: Settings2 },
    ],
  },
  {
    title: 'Безопасность',
    items: [
      { id: 'security-audit', label: 'Журнал действий', to: '/dashboard/admin/security/audit', icon: ScrollText },
    ],
  },
];

export const adminQuickActions = [
  { label: 'Добавить сотрудника', to: '/dashboard/admin/team/users' },
  { label: 'Подключить CRM', to: '/dashboard/admin/integrations' },
  { label: 'Аналитика', to: '/dashboard/admin/analytics' },
];

export const managerQuickActions = [
  { label: 'Очередь', to: '/dashboard/manager/requests' },
  { label: 'Календарь', to: '/dashboard/manager/calendar' },
  { label: 'Качество ИИ', to: '/dashboard/manager/ai-quality' },
];
