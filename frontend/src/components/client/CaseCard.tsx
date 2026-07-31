import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Clock3,
  FileEdit,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { presentClientCase } from '../../features/client-cases/presentClientCase';
import type { ClientCase } from '../../features/client-cases/types';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { resolveClientStatusTone } from '../../lib/clientStatusLegend';
import { clientProgressTone } from './ClientStatusBadge';

function CaseIcon({ group }: { group: ReturnType<typeof presentClientCase>['group'] }) {
  switch (group) {
    case 'draft':
      return <FileEdit size={18} />;
    case 'working':
      return <Wrench size={18} />;
    case 'scheduled':
      return <CalendarDays size={18} />;
    case 'done':
      return <CheckCircle2 size={18} />;
    case 'cancelled':
      return <CircleX size={18} />;
    case 'waiting':
    default:
      return <Clock3 size={18} />;
  }
}

export function CaseCard({
  clientCase,
  compact = false,
  featured = false,
}: {
  clientCase: ClientCase;
  compact?: boolean;
  featured?: boolean;
}) {
  const presented = presentClientCase(clientCase);
  const statusTone = resolveClientStatusTone(clientCase.status);
  const progressTone = clientProgressTone(clientCase.progressStage);
  const isScheduled = presented.group === 'scheduled' && Boolean(presented.bookingParts);
  const isDraft = presented.group === 'draft';

  return (
    <Link
      to={`/dashboard/client/cases/${clientCase.id}`}
      className={[
        'case-card',
        'is-link',
        compact ? 'case-card-compact' : '',
        featured ? 'is-featured' : '',
        presented.attention ? 'is-attention' : '',
        isScheduled ? 'is-scheduled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-status-tone={statusTone}
      data-progress-tone={progressTone}
      data-group={presented.group}
      data-kind={isDraft ? 'draft' : 'request'}
    >
      {isScheduled && presented.bookingParts ? (
        <div className="case-card-date">
          <span className="case-card-date-day">{presented.bookingParts.day}</span>
          <span className="case-card-date-time">{presented.bookingParts.time}</span>
          {presented.bookingRelative ? (
            <span className="case-card-date-relative">{presented.bookingRelative}</span>
          ) : null}
        </div>
      ) : (
        <span className="case-card-icon" aria-hidden>
          <CaseIcon group={presented.group} />
        </span>
      )}

      <div className="case-card-body">
        <div className="case-card-titles">
          <strong className="case-card-title">{clientCase.title}</strong>
          {clientCase.symptoms ? (
            <span className="case-card-symptoms">{clientCase.symptoms}</span>
          ) : null}
        </div>

        <div className="case-card-meta">
          <span className="case-card-status">{presented.statusLine}</span>
          {!isScheduled ? (
            <time dateTime={clientCase.lastActivityAt}>
              {formatRelativeTime(clientCase.lastActivityAt)}
            </time>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <span className="case-card-cta">
          {presented.ctaLabel}
          <ChevronRight size={16} aria-hidden />
        </span>
      ) : (
        <ChevronRight size={18} className="case-card-chevron" aria-hidden />
      )}
    </Link>
  );
}
