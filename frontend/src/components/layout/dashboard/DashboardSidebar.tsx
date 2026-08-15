import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Car, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DashboardNavItem } from '../../../config/dashboardNav';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { STORAGE_KEYS } from '../../../lib/storageKeys';

type SidebarProps = {
  items: DashboardNavItem[];
  groups?: Array<{ title: string; items: DashboardNavItem[] }>;
  badges?: Record<string, number>;
  mobileOpen: boolean;
  onMobileClose: () => void;
  allowCollapse?: boolean;
};

export function DashboardSidebar({
  items,
  groups,
  badges = {},
  mobileOpen,
  onMobileClose,
  allowCollapse = true,
}: SidebarProps) {
  const productConfig = useProductConfig();
  const canCollapse = allowCollapse;

  const [collapsed, setCollapsed] = useState(() => {
    if (!canCollapse) return false;
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === '1';
  });

  useEffect(() => {
    if (!canCollapse && collapsed) setCollapsed(false);
  }, [canCollapse, collapsed]);

  useEffect(() => {
    if (canCollapse) {
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? '1' : '0');
    }
  }, [collapsed, canCollapse]);

  const renderItem = (item: DashboardNavItem) => {
    const Icon = item.icon;
    const badge = badges[item.id] ?? item.badge;
    return (
      <NavLink
        key={item.id}
        to={item.to}
        end={item.to === '/dashboard/manager' || item.to === '/dashboard/admin' || item.to === '/dashboard/client'}
        className={({ isActive }) => `dashboard-sidebar-link${isActive ? ' active' : ''}`}
        onClick={onMobileClose}
        data-tooltip={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
      >
        <span className="dashboard-sidebar-link-icon">
          <Icon size={18} aria-hidden />
          {badge && collapsed ? <span className="dashboard-sidebar-dot" aria-hidden /> : null}
        </span>
        <span className="dashboard-sidebar-label">{item.label}</span>
        {badge && !collapsed ? (
          <span className="dashboard-sidebar-badge">{badge > 99 ? '99+' : badge}</span>
        ) : null}
      </NavLink>
    );
  };

  const itemGroups = groups
    ? groups
    : items.some((item) => item.group)
      ? Object.entries(
          items.reduce<Record<string, DashboardNavItem[]>>((acc, item) => {
            const key = item.group || 'Меню';
            acc[key] = acc[key] || [];
            acc[key].push(item);
            return acc;
          }, {}),
        ).map(([title, groupItems]) => ({ title, items: groupItems }))
      : [{ title: '', items }];

  return (
    <>
      <div
        className={`dashboard-sidebar-backdrop${mobileOpen ? ' open' : ''}`}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={`dashboard-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Боковая навигация"
      >
        <div className="dashboard-sidebar-brand">
          <NavLink to="/" className="dashboard-sidebar-brand-link" onClick={onMobileClose} title={productConfig.productName}>
            <span className="dashboard-sidebar-logo" aria-hidden>
              <Car size={18} />
            </span>
            <span className="dashboard-sidebar-brand-text">{productConfig.productName}</span>
          </NavLink>
          {canCollapse ? (
            <button
              type="button"
              className="dashboard-sidebar-collapse"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          ) : null}
        </div>

        <nav className="dashboard-sidebar-nav" aria-label="Разделы кабинета">
          {itemGroups.map((group, groupIndex) => (
            <div
              key={group.title || 'default'}
              className={`dashboard-sidebar-group${groupIndex > 0 ? ' has-divider' : ''}`}
            >
              {!collapsed && group.title ? <p className="dashboard-sidebar-group-title">{group.title}</p> : null}
              {collapsed && group.title ? (
                <span className="dashboard-sidebar-group-divider" aria-hidden title={group.title} />
              ) : null}
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
