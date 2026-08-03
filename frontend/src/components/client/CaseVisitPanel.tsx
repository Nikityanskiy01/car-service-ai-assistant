import { CalendarCheck2, CalendarDays, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ClientStatusBadge } from './ClientStatusBadge';
import { clientBookingStatusDescription } from '../../lib/clientStatusLabels';
import { resolveClientStatusTone } from '../../lib/clientStatusLegend';
import { formatBookingDayParts } from '../../lib/bookingCountdown';
import { resolveBookingUiContext } from '../../lib/bookingUiContext';

type Props = {
  bookingId?: string;
  preferredAt?: string;
  status?: string;
  onBook: () => void;
};

export function CaseVisitPanel({ bookingId, preferredAt, status, onBook }: Props) {
  if (!preferredAt) {
    return (
      <div className="case-visit-empty">
        <span className="case-visit-empty-icon" aria-hidden>
          <CalendarCheck2 size={28} strokeWidth={1.8} />
        </span>
        <div>
          <h2>Запись ещё не оформлена</h2>
          <p className="muted-text">Выберите удобное время — менеджер подтвердит слот.</p>
        </div>
        <Button onClick={onBook}>
          <CalendarDays size={16} aria-hidden />
          Записаться в сервис
        </Button>
      </div>
    );
  }

  const parts = formatBookingDayParts(preferredAt);
  const ui = resolveBookingUiContext(preferredAt, status || 'PENDING');
  const tone = resolveClientStatusTone(status || 'PENDING');
  const href = bookingId ? `/dashboard/client/bookings/${bookingId}` : '/dashboard/client/bookings';

  return (
    <article className="case-visit-card" data-status-tone={tone}>
      <div className="case-visit-date" aria-hidden>
        <span className="case-visit-date-num">{parts.day}</span>
        <span className="case-visit-date-month">{parts.month}</span>
        {ui.dateBadge ? <span className="case-visit-date-relative">{ui.dateBadge}</span> : null}
      </div>
      <div className="case-visit-copy">
        {status ? <ClientStatusBadge status={status} /> : null}
        <h2>
          {parts.weekday}, {parts.time}
        </h2>
        <p className="muted-text">{clientBookingStatusDescription(status || 'PENDING')}</p>
        <Link className="case-visit-link" to={href}>
          Открыть запись
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
