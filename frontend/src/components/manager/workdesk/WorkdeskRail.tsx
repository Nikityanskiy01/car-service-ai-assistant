import { Link } from 'react-router-dom';
import type { ActivityItem, ManagerKpi } from '../../../api/dashboard';
import { ActivityFeed } from '../ActivityFeed';
import { ManagerKpiFunnel } from '../ManagerKpiFunnel';
import { HintLabel } from '../help/HintLabel';
import { StatusBadge } from '../../ui/StatusBadge';
import { formatMinutesUntil } from '../../../lib/timeFormat';
import type { ServiceBooking } from '../../../types/dashboard';

type Props = {
  nextBooking: ServiceBooking | null;
  todayBookings: ServiceBooking[];
  activity: ActivityItem[];
  crmFailures: number;
  managerKpi: ManagerKpi | null;
  calendarPath: string;
  requestsPath: string;
  onOpenBooking: (booking: ServiceBooking) => void;
};

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function bookingLabel(booking: ServiceBooking) {
  return booking.client?.fullName || booking.guestName || 'Клиент';
}

function bookingCar(booking: ServiceBooking) {
  const fromVehicle = [booking.vehicle?.make, booking.vehicle?.model].filter(Boolean).join(' ');
  if (fromVehicle) return fromVehicle;
  const fromRequest = [booking.serviceRequest?.snapshotMake, booking.serviceRequest?.snapshotModel]
    .filter(Boolean)
    .join(' ');
  return fromRequest || booking.serviceName || '';
}

export function WorkdeskRail({
  nextBooking,
  todayBookings,
  activity,
  crmFailures,
  managerKpi,
  calendarPath,
  requestsPath,
  onOpenBooking,
}: Props) {
  const restToday = todayBookings.filter((item) => item.id !== nextBooking?.id);

  return (
    <aside className="workdesk-rail">
      <section className={`workdesk-panel workdesk-next${nextBooking ? ' has-visit' : ''}`}>
        <div className="workdesk-panel-head">
          <h2>Следующая запись</h2>
          <Link to={calendarPath}>Календарь</Link>
        </div>
        {nextBooking ? (
          <button type="button" className="workdesk-next-btn" onClick={() => onOpenBooking(nextBooking)}>
            <span className="workdesk-next-when">
              <strong className="workdesk-next-time">{formatClock(nextBooking.preferredAt)}</strong>
              <span className="workdesk-next-eta">{formatMinutesUntil(nextBooking.preferredAt)}</span>
            </span>
            <span className="workdesk-next-who">
              <span className="workdesk-next-name">{bookingLabel(nextBooking)}</span>
              {bookingCar(nextBooking) ? <span className="muted">{bookingCar(nextBooking)}</span> : null}
            </span>
            <StatusBadge status={nextBooking.status} />
          </button>
        ) : (
          <p className="workdesk-rail-hint muted">Новые записи появятся в календаре.</p>
        )}
      </section>

      <section className="workdesk-panel">
        <div className="workdesk-panel-head">
          <h2>Сегодня</h2>
          <span className="workdesk-count">{todayBookings.length}</span>
        </div>
        {restToday.length || (todayBookings.length > 0 && !nextBooking) ? (
          <ol className="workdesk-timeline">
            {(nextBooking ? restToday : todayBookings).map((booking) => (
              <li key={booking.id}>
                <button type="button" onClick={() => onOpenBooking(booking)}>
                  <time dateTime={booking.preferredAt}>{formatClock(booking.preferredAt)}</time>
                  <span className="workdesk-timeline-who">
                    <strong>{bookingLabel(booking)}</strong>
                    {bookingCar(booking) ? <span className="muted">{bookingCar(booking)}</span> : null}
                  </span>
                  <StatusBadge status={booking.status} />
                </button>
              </li>
            ))}
          </ol>
        ) : todayBookings.length === 1 && nextBooking ? (
          <p className="workdesk-rail-hint muted">Других записей на сегодня нет.</p>
        ) : (
          <p className="workdesk-rail-hint muted">Расписание дня пустое.</p>
        )}
      </section>

      <section className="workdesk-panel" id="activity-feed">
        <div className="workdesk-panel-head">
          <h2>События</h2>
          {crmFailures > 0 ? (
            <span className="workdesk-count is-danger">{crmFailures} в учёт</span>
          ) : (
            <Link to={requestsPath}>История</Link>
          )}
        </div>
        <ActivityFeed items={activity.slice(0, 6)} requestBasePath={requestsPath} compact />
      </section>

      {managerKpi ? (
        <section className="workdesk-panel workdesk-week">
          <div className="workdesk-panel-head">
            <h2>Неделя</h2>
          </div>
          <dl className="workdesk-week-stats">
            <div>
              <dt>Активные</dt>
              <dd>{managerKpi.personal.activeRequests}</dd>
            </div>
            <div>
              <dt>Сообщения</dt>
              <dd>{managerKpi.personal.messagesSent}</dd>
            </div>
            <div>
              <dt>
                <HintLabel hint="Сообщения с формы сайта, из которых сделали заявку">Из сообщений</HintLabel>
              </dt>
              <dd>{managerKpi.personal.contactsConverted}</dd>
            </div>
          </dl>
          <details>
            <summary>Воронка за {managerKpi.periodDays} дн.</summary>
            <ManagerKpiFunnel kpi={managerKpi} />
          </details>
        </section>
      ) : null}
    </aside>
  );
}
