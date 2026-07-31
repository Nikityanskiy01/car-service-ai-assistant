import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatBookingDateParts,
  formatBookingRelative,
  getBookingSubtitle,
  getBookingTitle,
} from '../../lib/bookingDisplay';
import { clientBookingStatusLabel } from '../../lib/clientStatusLabels';
import type { ServiceBooking } from '../../types/dashboard';
import { StatusBadge } from '../ui/StatusBadge';

type BookingCardProps = {
  booking: ServiceBooking;
  variant: 'upcoming' | 'past' | 'cancelled';
  serviceAddress?: string;
  featured?: boolean;
};

export function BookingCard({ booking, variant, serviceAddress, featured = false }: BookingCardProps) {
  const parts = formatBookingDateParts(booking.preferredAt);
  const relative = variant === 'upcoming' ? formatBookingRelative(booking.preferredAt) : null;
  const title = getBookingTitle(booking);
  const subtitle = getBookingSubtitle(booking);

  return (
    <Link
      to={`/dashboard/client/bookings/${booking.id}`}
      className={`booking-card is-link${featured ? ' is-featured' : ''}${variant === 'cancelled' ? ' is-cancelled' : ''}`}
    >
      <div className="booking-card-date">
        <span className="booking-card-date-day">{parts.day}</span>
        <span className="booking-card-date-time">{parts.time}</span>
        {relative ? <span className="booking-card-date-relative">{relative}</span> : null}
      </div>

      <div className="booking-card-body">
        <div className="booking-card-head">
          <span className="booking-card-icon" aria-hidden>
            <CalendarDays size={18} />
          </span>
          <div className="booking-card-titles">
            <strong>{title}</strong>
            {subtitle ? <span className="booking-card-subtitle">{subtitle}</span> : null}
          </div>
          <div className="booking-card-badges">
            <StatusBadge status={booking.status} />
          </div>
        </div>

        <div className="booking-card-meta">
          <span>{clientBookingStatusLabel(booking.status)}</span>
          {serviceAddress ? (
            <span className="booking-card-address">
              <MapPin size={13} aria-hidden />
              {serviceAddress}
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRight size={18} className="booking-card-chevron" aria-hidden />
    </Link>
  );
}
