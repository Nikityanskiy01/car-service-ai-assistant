import { NavLink } from 'react-router-dom';
import { Car } from 'lucide-react';
import type { DashboardNavItem } from '../../config/dashboardNav';
import { useProductConfig } from '../../config/ProductConfigProvider';

type ManagerSidebarProps = {
  items: DashboardNavItem[];
  badges?: Record<string, number>;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function ManagerSidebar({ items, badges = {}, mobileOpen, onMobileClose }: ManagerSidebarProps) {
  const productConfig = useProductConfig();

  return (
    <>
      <div
        className={`dashboard-sidebar-backdrop${mobileOpen ? ' open' : ''}`}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={`dashboard-sidebar${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Навигация кабинета менеджера"
      >
        <div className="dashboard-sidebar-brand">
          <NavLink
            to="/"
            className="dashboard-sidebar-brand-link"
            onClick={onMobileClose}
            title={productConfig.productName}
          >
            <span className="dashboard-sidebar-logo" aria-hidden>
              <Car size={18} />
            </span>
            <span className="dashboard-sidebar-brand-text">{productConfig.productName}</span>
          </NavLink>
        </div>

        <nav className="dashboard-sidebar-nav" aria-label="Разделы кабинета">
          {items.map((item) => {
            const Icon = item.icon;
            const badge = badges[item.id] ?? item.badge;
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/dashboard/manager'}
                onClick={onMobileClose}
                className={({ isActive }) => `dashboard-sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="dashboard-sidebar-link-icon">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="dashboard-sidebar-label">{item.label}</span>
                {badge ? (
                  <span className="dashboard-sidebar-badge">{badge > 99 ? '99+' : badge}</span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
