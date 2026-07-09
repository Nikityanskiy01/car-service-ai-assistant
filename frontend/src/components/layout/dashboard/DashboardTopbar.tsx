import { Link } from 'react-router-dom';
import { AlertTriangle, Menu, Search } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import { useAppRuntime } from '../../../app/providers/AppRuntimeProvider';
import { ThemeToggle } from '../ThemeToggle';
import { DemoModeBanner } from '../../product/DemoModeBanner';
import { Button } from '../../ui/Button';
import { UserAvatar } from '../../ui/UserAvatar';

export function DashboardTopbar({
  title,
  onMenuClick,
  integrationIssues,
}: {
  title: string;
  onMenuClick: () => void;
  integrationIssues?: number;
}) {
  const { user, logout } = useAuth();
  const { demoMode } = useAppRuntime();

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        <button type="button" className="dashboard-topbar-menu" onClick={onMenuClick} aria-label="Открыть меню">
          <Menu size={18} />
        </button>
        <h2 className="dashboard-topbar-title">{title}</h2>
      </div>
      <div className="dashboard-topbar-center">
        <label className="dashboard-search" aria-label="Поиск">
          <Search size={16} />
          <input type="search" placeholder="Поиск заявок и клиентов…" disabled title="Скоро" />
        </label>
      </div>
      <div className="dashboard-topbar-right">
        {integrationIssues ? (
          <Link to="/dashboard/admin/integrations" className="dashboard-integration-alert" title="Проблемы интеграций">
            <AlertTriangle size={16} />
            <span>{integrationIssues}</span>
          </Link>
        ) : null}
        <DemoModeBanner enabled={demoMode} />
        <ThemeToggle />
        {user ? (
          <div className="dashboard-profile">
            <UserAvatar name={user.fullName || user.email} />
            <div className="dashboard-profile-meta">
              <strong>{user.fullName || 'Пользователь'}</strong>
              <small>{user.email}</small>
            </div>
            <Button variant="ghost" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
