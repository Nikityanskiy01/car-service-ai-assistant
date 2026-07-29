import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

export function DashboardRecordCard({
  title,
  subtitle,
  meta,
  status,
  icon: Icon,
  to,
  onClick,
  actions,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  icon?: LucideIcon;
  to?: string;
  onClick?: () => void;
  actions?: ReactNode;
}) {
  const inner = (
    <>
      {Icon ? (
        <span className="desk-record-icon" aria-hidden>
          <Icon size={18} />
        </span>
      ) : null}
      <div className="desk-record-body">
        <strong>{title}</strong>
        {subtitle ? <span className="desk-record-subtitle">{subtitle}</span> : null}
        {meta ? <span className="desk-record-meta">{meta}</span> : null}
      </div>
      <div className="desk-record-end">
        {status ? <StatusBadge status={status} /> : null}
        {actions}
        {to ? <ChevronRight size={16} className="desk-record-chevron" aria-hidden /> : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="desk-record-card is-link">
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="desk-record-card is-link" onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <article className="desk-record-card">{inner}</article>;
}
