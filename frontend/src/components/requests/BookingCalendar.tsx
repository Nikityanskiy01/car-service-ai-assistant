import { StatusBadge } from '../ui/StatusBadge';
import { getBookingVehicleLabel } from '../../lib/bookingDisplay';
import type { ServiceBooking } from '../../types/dashboard';

interface BookingItem {
  id: string;
  preferredAt: string;
  status: string;
  guestName?: string | null;
  guestPhone?: string | null;
  notes?: string | null;
  serviceRequestId?: string | null;
  client?: { fullName?: string | null; phone?: string | null } | null;
  serviceRequest?: { id: string; status: string } | null;
}

const DAY_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function dayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
  const label = DAY_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function BookingCalendar({
  bookings,
  onSelect,
}: {
  bookings: BookingItem[];
  onSelect?: (booking: ServiceBooking) => void;
}) {
  const grouped = bookings.reduce<Record<string, BookingItem[]>>((acc, booking) => {
    const day = new Date(booking.preferredAt).toDateString();
    acc[day] = acc[day] || [];
    acc[day].push(booking);
    return acc;
  }, {});

  const days = Object.entries(grouped).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
  );

  return (
    <section className="booking-calendar" aria-label="Календарь записей">
      {!days.length ? (
        <p className="muted">Пока нет назначенных записей.</p>
      ) : (
        <div className="booking-days">
          {days.map(([day, items]) => {
            const date = new Date(day);
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <article key={day} className={`booking-day${isToday ? ' is-today' : ''}`}>
                <header className="booking-day-header">
                  <h4>{dayLabel(date)}</h4>
                  <span className="tnum">{items.length}</span>
                </header>
                <ul>
                  {items
                    .slice()
                    .sort((a, b) => a.preferredAt.localeCompare(b.preferredAt))
                    .map((item) => {
                      const content = (
                        <>
                          <strong className="tnum">
                            {new Date(item.preferredAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </strong>
                          <span>{item.client?.fullName || item.guestName || 'Клиент'}</span>
                          <span className="muted booking-day-car">
                            {getBookingVehicleLabel(item as ServiceBooking) || ''}
                          </span>
                          <StatusBadge status={item.status} />
                        </>
                      );
                      return (
                        <li key={item.id}>
                          {onSelect ? (
                            <button
                              type="button"
                              className="booking-list-btn"
                              onClick={() => onSelect(item as ServiceBooking)}
                            >
                              {content}
                            </button>
                          ) : (
                            <span className="booking-list-static">{content}</span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
