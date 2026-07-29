import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCachedUser } from '../../api/client';
import { listBookings } from '../../api/dashboard';
import { BookingCalendar } from '../../components/requests/BookingCalendar';
import { BookingDrawer } from '../../components/requests/BookingDrawer';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceBooking } from '../../types/dashboard';

type ManagerCalendarPageProps = {
  adminZone?: boolean;
};

export function ManagerCalendarPage({ adminZone = false }: ManagerCalendarPageProps) {
  usePageMeta({
    title: adminZone ? 'Записи — операции' : 'Календарь',
    description: 'Записи на обслуживание.',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [view, setView] = useState('week');
  const [selected, setSelected] = useState<ServiceBooking | null>(null);
  const [calendarFilter, setCalendarFilter] = useState('all');
  const managerId = getCachedUser()?.id;

  useEffect(() => {
    void listBookings()
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toDateString();
  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (calendarFilter === 'today') {
      list = list.filter((b) => new Date(b.preferredAt).toDateString() === today);
    }
    if (calendarFilter === 'mine' && managerId) {
      list = list.filter((b) => b.serviceRequest?.assignedManagerId === managerId);
    }
    if (calendarFilter === 'with-request') {
      list = list.filter((b) => Boolean(b.serviceRequestId));
    }
    return list;
  }, [bookings, calendarFilter, managerId, today]);

  const todayBookings = filteredBookings.filter((b) => new Date(b.preferredAt).toDateString() === today);

  const capacityByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of filteredBookings) {
      const key = new Date(b.preferredAt).toDateString();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [filteredBookings]);

  const capacityMax = Math.max(...Array.from(capacityByDay.values()), 1);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={adminZone ? 'Записи' : 'Календарь'}
        description="Запланированные визиты и записи клиентов."
        breadcrumbs={
          adminZone
            ? [
                { label: 'Пульт', to: '/dashboard/admin' },
                { label: 'Операции' },
                { label: 'Записи' },
              ]
            : [
                { label: 'Рабочий стол', to: '/dashboard/manager' },
                { label: 'Календарь' },
              ]
        }
        actions={
          <Link to="/booking">
            <span className="btn btn-secondary">Создать запись</span>
          </Link>
        }
      />

      <Tabs
        value={calendarFilter}
        onChange={setCalendarFilter}
        items={[
          { id: 'all', label: 'Все' },
          { id: 'today', label: 'Сегодня' },
          { id: 'mine', label: 'Мои' },
          { id: 'with-request', label: 'С заявкой' },
        ]}
      />

      <Tabs
        value={view}
        onChange={setView}
        items={[
          { id: 'day', label: 'День' },
          { id: 'week', label: 'Неделя' },
          { id: 'list', label: 'Список' },
        ]}
      />

      {view === 'day' && (
        <Card>
          <h2>Сегодня</h2>
          <ul className="simple-list booking-click-list">
            {todayBookings.map((b) => (
              <li key={b.id}>
                <button type="button" className="booking-list-btn" onClick={() => setSelected(b)}>
                  <strong>
                    {new Date(b.preferredAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </strong>
                  <span>{b.client?.fullName || b.guestName || 'Клиент'}</span>
                  <StatusBadge status={b.status} />
                </button>
              </li>
            ))}
            {!todayBookings.length ? <p className="muted">На сегодня записей нет.</p> : null}
          </ul>
        </Card>
      )}

      {(view === 'week' || view === 'list') && (
        <>
          {adminZone ? (
            <Card>
              <h2>Загрузка постов (7 дней)</h2>
              <div className="booking-capacity-row">
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const key = d.toDateString();
                  const count = capacityByDay.get(key) || 0;
                  const pct = Math.round((count / capacityMax) * 100);
                  return (
                    <div key={key} className="booking-capacity-day">
                      <span>{d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}</span>
                      <div className="booking-capacity-bar" aria-hidden>
                        <div className="booking-capacity-fill" style={{ height: `${Math.max(8, pct)}%` }} />
                      </div>
                      <em>{count}</em>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
          <BookingCalendar bookings={filteredBookings} onSelect={(b) => setSelected(b)} />
        </>
      )}

      {view === 'list' && (
        <Card>
          <h2>Все записи</h2>
          <ul className="simple-list booking-click-list">
            {filteredBookings.map((b) => (
              <li key={b.id}>
                <button type="button" className="booking-list-btn" onClick={() => setSelected(b)}>
                  <strong>{new Date(b.preferredAt).toLocaleString('ru-RU')}</strong>
                  <span>{b.client?.fullName || b.guestName || 'Клиент'}</span>
                  <StatusBadge status={b.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <BookingDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        showAudit={adminZone}
        requestBasePath={adminZone ? '/dashboard/admin/operations/requests' : '/dashboard/manager/requests'}
      />
    </div>
  );
}
