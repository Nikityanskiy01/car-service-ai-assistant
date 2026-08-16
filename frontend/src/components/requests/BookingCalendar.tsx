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

export function BookingStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
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

  if (!days.length) {
    return <p className="muted">Пока нет назначенных записей.</p>;
  }

  return (
    <section className="booking-days" aria-label="Календарь записей">
      {days.map(([day, items]) => {
        const date = new Date(day);
        const isToday = date.toDateString() === new Date().toDateString();
        return (
          <article key={day} className={`booking-day${isToday ? ' is-today' : ''}`}>
            <header className="booking-day-header">
              <h4>{dayLabel(date)}</h4>
              <span className="muted tnum">{items.length}</span>
            </header>
            <ul className="booking-click-list">
              {items
                .slice()
                .sort((a, b) => a.preferredAt.localeCompare(b.preferredAt))
                .map((item) => {
                  const name = item.client?.fullName || item.guestName || 'Клиент';
                  const car = getBookingVehicleLabel(item as ServiceBooking);
                  const time = new Date(item.preferredAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const inner = (
                    <>
                      <strong className="tnum">{time}</strong>
                      <span>
                        {name}
                        {car ? <span className="booking-day-car muted">{car}</span> : null}
                      </span>
                      <BookingStatusBadge status={item.status} />
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
                          {inner}
                        </button>
                      ) : (
                        <div className="booking-list-static">{inner}</div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
