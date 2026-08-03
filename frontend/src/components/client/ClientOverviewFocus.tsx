import { CalendarDays, ChevronRight, MapPin, MessageSquare, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { OverviewFocus } from '../../features/client-cases/resolveOverviewFocus';
import { clientBookingStatusDescription } from '../../lib/clientStatusLabels';
import { CLIENT_CALENDAR_FILE_HINT } from '../../lib/clientStatusLegend';
import { formatBookingCountdown, formatBookingDayParts } from '../../lib/bookingCountdown';
import { buildBookingIcs, downloadBookingIcs } from '../../lib/buildBookingIcs';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';

export function ClientOverviewFocus({
  focus,
  serviceAddress,
  onHeroCta,
  onDownloadIcs,
}: {
  focus: OverviewFocus;
  serviceAddress: string | null;
  onHeroCta: () => void;
  onDownloadIcs: () => void;
}) {
  if (focus.type === 'booking') {
    const parts = formatBookingDayParts(focus.booking.preferredAt);
    const countdown = formatBookingCountdown(focus.booking.preferredAt);

    return (
      <section className="client-overview-focus client-overview-focus-booking" aria-label="Ближайшая запись">
        <div className="client-overview-focus-booking-main">
          <div className="client-overview-focus-date">
            <span className="client-overview-focus-date-day">{parts.day}</span>
            <span className="client-overview-focus-date-month">{parts.month}</span>
          </div>
          <div className="client-overview-focus-copy">
            <div className="client-overview-focus-meta">
              {countdown ? <span className="client-overview-focus-pill">{countdown}</span> : null}
              <StatusBadge status={focus.booking.status} />
            </div>
            <h2>
              {parts.weekday}, {parts.time}
            </h2>
            <p>{clientBookingStatusDescription(focus.booking.status)}</p>
            {serviceAddress ? (
              <p className="client-overview-focus-location">
                <MapPin size={14} aria-hidden />
                {serviceAddress}
              </p>
            ) : null}
          </div>
        </div>
        <div className="client-overview-focus-actions">
          <Link className="btn btn-primary" to={`/dashboard/client/bookings/${focus.booking.id}`}>
            Детали записи
            <ChevronRight size={16} aria-hidden />
          </Link>
          <Button
            type="button"
            variant="secondary"
            title={CLIENT_CALENDAR_FILE_HINT}
            aria-label="Скачать напоминание для календаря"
            onClick={onDownloadIcs}
          >
            <CalendarDays size={16} aria-hidden />
            В календарь
          </Button>
          <Link className="client-overview-focus-link" to="/dashboard/client/bookings">
            Все записи
          </Link>
        </div>
      </section>
    );
  }

  if (focus.type === 'draft') {
    return (
      <section className="client-overview-focus client-overview-focus-draft" aria-label="Незавершённая диагностика">
        <span className="client-overview-focus-icon" aria-hidden>
          <MessageSquare size={20} />
        </span>
        <div className="client-overview-focus-copy">
          <p className="client-overview-focus-kicker">Незавершённая диагностика</p>
          <h2>{focus.title}</h2>
          <p>{focus.description}</p>
        </div>
        <div className="client-overview-focus-actions">
          <Button type="button" onClick={onHeroCta}>
            {focus.ctaLabel}
          </Button>
        </div>
      </section>
    );
  }

  const { hero } = focus;
  return (
    <section className="client-overview-focus client-overview-focus-hero" aria-label="Следующий шаг">
      <span className="client-overview-focus-icon" aria-hidden>
        <Sparkles size={20} />
      </span>
      <div className="client-overview-focus-copy">
        <p className="client-overview-focus-kicker">Следующий шаг</p>
        <h2>{hero.title}</h2>
        <p>{hero.description}</p>
      </div>
      <div className="client-overview-focus-actions">
        <Button type="button" onClick={onHeroCta}>
          {hero.ctaLabel}
        </Button>
        {hero.secondaryLabel && hero.secondaryTo ? (
          <Link className="btn btn-secondary" to={hero.secondaryTo}>
            {hero.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function buildBookingIcsDownload({
  bookingId,
  preferredAt,
  serviceName,
  serviceAddress,
}: {
  bookingId: string;
  preferredAt: string;
  serviceName: string;
  serviceAddress: string | null;
}) {
  const ics = buildBookingIcs({
    id: bookingId,
    preferredAt,
    title: `Запись — ${serviceName}`,
    location: serviceAddress ?? undefined,
  });
  downloadBookingIcs(ics, `booking-${bookingId}.ics`);
}
