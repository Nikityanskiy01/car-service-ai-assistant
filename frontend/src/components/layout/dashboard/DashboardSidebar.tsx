import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DashboardNavItem } from '../../../config/dashboardNav';
import { productConfig } from '../../../config/productConfig';
import { STORAGE_KEYS } from '../../../lib/storageKeys';

type SidebarProps = {
  items: DashboardNavItem[];
  groups?: Array<{ title: string; items: DashboardNavItem[] }>;
  badges?: Record<string, number>;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function DashboardSidebar({ items, groups, badges = {}, mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === '1');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? '1' : '0');
  }, [collapsed]);

  const renderItem = (item: DashboardNavItem) => {
    const Icon = item.icon;
    const badge = badges[item.id] ?? item.badge;
    return (
      <NavLink
        key={item.id}
        to={item.to}
        end={item.to === '/dashboard/manager' || item.to === '/dashboard/admin'}
        className={({ isActive }) => `dashboard-sidebar-link${isActive ? ' active' : ''}`}
        onClick={onMobileClose}
        title={collapsed ? item.label : undefined}
      >
        <Icon size={18} aria-hidden />
        <span className="dashboard-sidebar-label">{item.label}</span>
        {badge ? <span className="dashboard-sidebar-badge">{badge > 99 ? '99+' : badge}</span> : null}
      </NavLink>
    );
  };

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
          <strong>{collapsed ? productConfig.shortName : productConfig.productName}</strong>
          <button
            type="button"
            className="dashboard-sidebar-collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="dashboard-sidebar-nav">
          {groups
            ? groups.map((group) => (
                <div key={group.title} className="dashboard-sidebar-group">
                  {!collapsed && <p className="dashboard-sidebar-group-title">{group.title}</p>}
                  {group.items.map(renderItem)}
                </div>
              ))
            : items.map((item) => (
                <div key={item.id} className="dashboard-sidebar-group">
                  {renderItem(item)}
                </div>
              ))}
        </nav>
      </aside>
    </>
  );
}
