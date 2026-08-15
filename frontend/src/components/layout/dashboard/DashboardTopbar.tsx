import { Link } from 'react-router-dom';
import { AlertTriangle, Menu, Search } from 'lucide-react';
import { AdminStatusStrip } from '../../admin/AdminStatusStrip';
import { useAdminSystemStatus } from '../../../hooks/useAdminSystemStatus';
import { ThemeToggle } from '../ThemeToggle';
import { InboxBell } from '../../notifications/InboxBell';
import { UserMenu } from './UserMenu';

export function DashboardTopbar({
  title,
  roleLabel,
  profilePath,
  onMenuClick,
  integrationIssues,
  adminZone,
  onCommandPalette,
}: {
  title: string;
  roleLabel?: string;
  profilePath: string;
  onMenuClick: () => void;
  integrationIssues?: number;
  adminZone?: boolean;
  onCommandPalette?: () => void;
}) {
  const systemStatus = useAdminSystemStatus(!!adminZone);

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        <button type="button" className="dashboard-topbar-menu" onClick={onMenuClick} aria-label="Открыть меню">
          <Menu size={18} />
        </button>
        <div className="dashboard-topbar-heading">
          <h2 className="dashboard-topbar-title">{title}</h2>
          {roleLabel ? <span className="dashboard-role-chip">{roleLabel}</span> : null}
        </div>
      </div>
      {adminZone ? (
        <AdminStatusStrip
          llm={systemStatus.llm}
          integrationIssues={systemStatus.integrationIssues || integrationIssues || 0}
          failedJobs={systemStatus.failedJobs}
          newRequests={systemStatus.newRequests}
          loading={systemStatus.loading}
        />
      ) : null}
      <div className="dashboard-topbar-right">
        {onCommandPalette ? (
          <button
            type="button"
            className="dashboard-command-trigger"
            onClick={onCommandPalette}
            aria-label="Командная палитра"
            title="Командная палитра (Ctrl+K)"
          >
            <Search size={16} />
            <span>Поиск</span>
            <kbd>Ctrl+K</kbd>
          </button>
        ) : null}
        {!adminZone && integrationIssues ? (
          <Link to="/dashboard/admin/integrations" className="dashboard-integration-alert" title="Проблемы интеграций">
            <AlertTriangle size={16} />
            <span>{integrationIssues}</span>
          </Link>
        ) : null}
        <ThemeToggle />
        <InboxBell />
        <UserMenu profilePath={profilePath} />
      </div>
    </header>
  );
}
