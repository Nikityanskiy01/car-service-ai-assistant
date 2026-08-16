import { getBookingVehicleLabel } from '../../lib/bookingDisplay';
import { daysInRange, isoDay, isSameLocalDay } from '../../lib/calendarDays';
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждена',
  ARRIVED: 'Приехал',
  NO_SHOW: 'Не приехал',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
};

export const CALENDAR_STATUS_LEGEND = [
  { status: 'PENDING', label: STATUS_LABELS.PENDING, hint: 'Ещё не подтвердили' },
  { status: 'CONFIRMED', label: STATUS_LABELS.CONFIRMED, hint: 'Клиент приедет' },
  { status: 'ARRIVED', label: STATUS_LABELS.ARRIVED, hint: 'Уже на посту' },
  { status: 'COMPLETED', label: STATUS_LABELS.COMPLETED, hint: 'Работу закрыли' },
  { status: 'NO_SHOW', label: STATUS_LABELS.NO_SHOW, hint: 'Клиент не пришёл' },
  { status: 'CANCELLED', label: STATUS_LABELS.CANCELLED, hint: 'Запись сняли' },
] as const;

const WEEKDAY = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const MONTH_SHORT = new Intl.DateTimeFormat('ru-RU', { month: 'short' });

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

function statusSlug(status: string) {
  return String(status).toLowerCase().replace(/_/g, '-');
}

export function BookingStatusBadge({ status }: { status: string }) {
  return <span className={`booking-event-status is-${statusSlug(status)}`}>{statusLabel(status)}</span>;
}

export function BookingCalendarLegend() {
  return (
    <section className="calendar-legend" aria-labelledby="calendar-legend-title">
      <header className="calendar-legend-head">
        <div>
          <h4 id="calendar-legend-title">Как читать записи</h4>
          <p className="muted">Полоска слева на карточке совпадает со статусом.</p>
        </div>
        <p className="calendar-legend-today-chip">
          <span className="calendar-legend-today tnum" aria-hidden="true">
            {new Date().getDate()}
          </span>
          Оранжевый кружок с числом отмечает сегодняшний день
        </p>
      </header>
      <ul className="calendar-legend-grid">
        {CALENDAR_STATUS_LEGEND.map((item) => (
          <li key={item.status} className="calendar-legend-card" data-status={statusSlug(item.status)}>
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BookingEventCard({
  booking,
  onSelect,
  layout = 'stack',
  showDate = false,
}: {
  booking: BookingItem;
  onSelect?: (booking: ServiceBooking) => void;
  layout?: 'stack' | 'row';
  showDate?: boolean;
}) {
  const name = booking.client?.fullName || booking.guestName || 'Клиент';
  const car = getBookingVehicleLabel(booking as ServiceBooking) || 'Авто не указано';
  const at = new Date(booking.preferredAt);
  const time = at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const when = showDate
    ? at.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : time;
  const label = statusLabel(booking.status);
  const slug = statusSlug(booking.status);
  const title = `${when}, ${name}, ${car}, ${label}`;

  const inner = (
    <>
      <span className="booking-event-meta">
        <strong className="booking-event-time tnum">{when}</strong>
        <span className={`booking-event-status is-${slug}`}>{label}</span>
      </span>
      <span className="booking-event-copy">
        <span className="booking-event-name">{name}</span>
        <span className="booking-event-car">{car}</span>
      </span>
    </>
  );

  const className = `booking-event is-${layout} is-${slug}`;

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        data-status={slug}
        title={title}
        aria-label={title}
        onClick={() => onSelect(booking as ServiceBooking)}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} data-status={slug} title={title}>
      {inner}
    </div>
  );
}

export function BookingCalendar({
  bookings,
  onSelect,
  startDate,
  dayCount = 7,
  onOpenDay,
}: {
  bookings: BookingItem[];
  onSelect?: (booking: ServiceBooking) => void;
  startDate: Date;
  dayCount?: number;
  onOpenDay?: (date: Date) => void;
}) {
  const columns = daysInRange(startDate, dayCount);
  const grouped = bookings.reduce<Record<string, BookingItem[]>>((acc, booking) => {
    const key = isoDay(new Date(booking.preferredAt));
    acc[key] = acc[key] || [];
    acc[key].push(booking);
    return acc;
  }, {});
  const today = new Date();
  const isDayView = dayCount === 1;

  return (
    <section
      className={`booking-week${isDayView ? ' is-day' : ''}`}
      aria-label={isDayView ? 'Записи за день' : 'Календарь на 7 дней'}
    >
      {columns.map((date) => {
        const key = isoDay(date);
        const items = (grouped[key] || []).slice().sort((a, b) => a.preferredAt.localeCompare(b.preferredAt));
        const todayColumn = isSameLocalDay(date, today);
        const weekday = WEEKDAY.format(date);
        const month = MONTH_SHORT.format(date).replace('.', '');

        return (
          <article
            key={key}
            id={`cal-day-${key}`}
            className={`booking-week-day${todayColumn ? ' is-today' : ''}${items.length ? '' : ' is-empty'}`}
          >
            {onOpenDay && !isDayView ? (
              <button
                type="button"
                className="booking-week-head"
                onClick={() => onOpenDay(date)}
                aria-label={`Открыть ${date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
              >
                <span className="booking-week-weekday">{weekday}</span>
                <span className="booking-week-date">
                  <strong className="booking-week-num tnum">{date.getDate()}</strong>
                  <span className="muted">{todayColumn ? 'сегодня' : month}</span>
                </span>
                <span className="booking-week-count tnum">{items.length}</span>
              </button>
            ) : (
              <header className="booking-week-head">
                <span className="booking-week-weekday">{weekday}</span>
                <span className="booking-week-date">
                  <strong className="booking-week-num tnum">{date.getDate()}</strong>
                  <span className="muted">{todayColumn ? 'сегодня' : month}</span>
                </span>
                <span className="booking-week-count tnum">{items.length}</span>
              </header>
            )}
            {items.length ? (
              <ul className="booking-week-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <BookingEventCard booking={item} onSelect={onSelect} layout={isDayView ? 'row' : 'stack'} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="booking-week-empty">Свободно</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
