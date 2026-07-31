import { CalendarDays, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ClientStatusBadge } from './ClientStatusBadge';
import { clientBookingStatusDescription } from '../../lib/clientStatusLabels';
import { CLIENT_CALENDAR_FILE_HINT, resolveClientStatusTone } from '../../lib/clientStatusLegend';
import { buildBookingIcs, downloadBookingIcs } from '../../lib/buildBookingIcs';
import { formatBookingCountdown, formatBookingDayParts } from '../../lib/bookingCountdown';

type BookingSpotlightProps = {
  booking: { id: string; preferredAt: string; status: string };
  serviceName: string;
  serviceAddress: string;
};

export function ClientOverviewBookingSpotlight({
  booking,
  serviceName,
  serviceAddress,
}: BookingSpotlightProps) {
  const parts = formatBookingDayParts(booking.preferredAt);
  const countdown = formatBookingCountdown(booking.preferredAt);
  const tone = resolveClientStatusTone(booking.status);
  const bookingHref = `/dashboard/client/bookings/${booking.id}`;

  function handleCalendarDownload() {
    const ics = buildBookingIcs({
      id: booking.id,
      preferredAt: booking.preferredAt,
      title: `Визит — ${serviceName}`,
      location: serviceAddress,
    });
    downloadBookingIcs(ics, `booking-${booking.id}.ics`);
  }

  return (
    <section className="client-overview-booking-hero" aria-label="Ближайший визит">
      <div className="client-overview-booking-hero-head">
        <span className="client-overview-booking-kicker">Ближайший визит</span>
        <Link to="/dashboard/client/bookings">Все записи</Link>
      </div>
      <article className="client-overview-booking-spotlight" data-status-tone={tone}>
        <Link to={bookingHref} className="client-overview-booking-main">
          <div className="client-overview-booking-date">
            <span className="client-overview-booking-date-num">{parts.day}</span>
            <span className="client-overview-booking-date-month">{parts.month}</span>
            {countdown ? (
              <span className="client-overview-booking-date-relative">{countdown}</span>
            ) : null}
          </div>
          <div className="client-overview-booking-copy">
            <div className="client-overview-booking-meta">
              <ClientStatusBadge status={booking.status} />
            </div>
            <h2 className="client-overview-booking-title">
              {parts.weekday}, {parts.time}
            </h2>
            <p>{clientBookingStatusDescription(booking.status)}</p>
          </div>
          <ChevronRight size={18} className="client-overview-booking-chevron" aria-hidden />
        </Link>
        <div className="client-overview-booking-footer">
          <button
            type="button"
            className="client-overview-booking-calendar-link"
            title={CLIENT_CALENDAR_FILE_HINT}
            aria-label="Скачать напоминание для календаря"
            onClick={handleCalendarDownload}
          >
            <CalendarDays size={14} aria-hidden />
            В календарь
          </button>
        </div>
      </article>
    </section>
  );
}
