import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, RefreshCw } from 'lucide-react';
import { getCachedUser } from '../../api/client';
import { listBookings } from '../../api/dashboard';
import { BookingCalendar } from '../../components/requests/BookingCalendar';
import { BookingDrawer } from '../../components/requests/BookingDrawer';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { managerZonePaths } from '../../config/managerPaths';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getBookingVehicleLabel } from '../../lib/bookingDisplay';
import { formatMinutesUntil } from '../../lib/timeFormat';
import type { ServiceBooking } from '../../types/dashboard';

type ManagerCalendarPageProps = {
  adminZone?: boolean;
};

type CalendarFilter = 'all' | 'today' | 'mine' | 'with-request' | 'unconfirmed';
type CalendarView = 'day' | 'week' | 'list';

const OPEN_STATUSES = ['PENDING', 'CONFIRMED'];

export function ManagerCalendarPage({ adminZone = false }: ManagerCalendarPageProps) {
  usePageMeta({
    title: adminZone ? 'Записи — операции' : 'Календарь',
    description: 'Записи на обслуживание.',
  });

  const paths = managerZonePaths(adminZone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [view, setView] = useState<CalendarView>('week');
  const [selected, setSelected] = useState<ServiceBooking | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const managerId = getCachedUser()?.id;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setBookings(await listBookings());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить записи');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useDashboardPolling(() => void load(true), 90_000);

  const today = new Date().toDateString();

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (calendarFilter === 'today') {
      list = list.filter((booking) => new Date(booking.preferredAt).toDateString() === today);
    }
    if (calendarFilter === 'mine' && managerId) {
      list = list.filter((booking) => booking.serviceRequest?.assignedManagerId === managerId);
    }
    if (calendarFilter === 'with-request') {
      list = list.filter((booking) => Boolean(booking.serviceRequestId));
    }
    if (calendarFilter === 'unconfirmed') {
      list = list.filter((booking) => booking.status === 'PENDING');
    }
    return [...list].sort((a, b) => a.preferredAt.localeCompare(b.preferredAt));
  }, [bookings, calendarFilter, managerId, today]);

  const todayBookings = useMemo(
    () => filteredBookings.filter((booking) => new Date(booking.preferredAt).toDateString() === today),
    [filteredBookings, today],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      today: bookings.filter((booking) => new Date(booking.preferredAt).toDateString() === today).length,
      pending: bookings.filter((booking) => booking.status === 'PENDING').length,
      upcoming: bookings.filter(
        (booking) =>
          OPEN_STATUSES.includes(booking.status) && new Date(booking.preferredAt).getTime() > now,
      ).length,
    };
  }, [bookings, today]);

  const capacityByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of filteredBookings) {
      const key = new Date(booking.preferredAt).toDateString();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [filteredBookings]);

  const capacityMax = Math.max(...Array.from(capacityByDay.values()), 1);

  function applyUpdatedBooking(updated: ServiceBooking) {
    setBookings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  }

  if (loading) return <Loader label="Загружаем записи…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page manager-calendar-page">
      <PageHeader
        title={adminZone ? 'Записи' : 'Календарь'}
        description="Запланированные визиты и загрузка постов."
        breadcrumbs={adminZone ? undefined : [
                { label: 'Рабочий стол', to: paths.root },
                { label: 'Календарь' },
              ]
        }
        actions={
          <div className="row gap-sm">
            <Button variant="ghost" onClick={() => void load()}>
              <RefreshCw size={16} aria-hidden />
              Обновить
            </Button>
            <Link to="/booking" className="btn btn-secondary">
              <CalendarPlus size={16} aria-hidden />
              Создать запись
            </Link>
          </div>
        }
      />

      <div className="calendar-stat-row">
        <div>
          <span className="muted">Сегодня</span>
          <strong className="tnum">{stats.today}</strong>
        </div>
        <div>
          <span className="muted">Ждут подтверждения</span>
          <strong className="tnum">{stats.pending}</strong>
        </div>
        <div>
          <span className="muted">Впереди</span>
          <strong className="tnum">{stats.upcoming}</strong>
        </div>
      </div>

      <div className="calendar-toolbar">
        <Tabs
          value={calendarFilter}
          onChange={(value) => setCalendarFilter(value as CalendarFilter)}
          items={[
            { id: 'all', label: 'Все' },
            { id: 'today', label: 'Сегодня' },
            { id: 'mine', label: 'Мои' },
            { id: 'unconfirmed', label: 'Без подтверждения' },
            { id: 'with-request', label: 'С заявкой' },
          ]}
        />
        <Tabs
          value={view}
          onChange={(value) => setView(value as CalendarView)}
          items={[
            { id: 'day', label: 'День' },
            { id: 'week', label: 'Неделя' },
            { id: 'list', label: 'Список' },
          ]}
        />
      </div>

      {view === 'day' && (
        <Card>
          <header className="card-section-header">
            <h2>Сегодня</h2>
            <span className="muted tnum">{todayBookings.length} записей</span>
          </header>
          {todayBookings.length ? (
            <ul className="booking-click-list">
              {todayBookings.map((booking) => (
                <li key={booking.id}>
                  <button type="button" className="booking-list-btn" onClick={() => setSelected(booking)}>
                    <strong className="tnum">
                      {new Date(booking.preferredAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                    <span>{booking.client?.fullName || booking.guestName || 'Клиент'}</span>
                    <span className="muted">{getBookingVehicleLabel(booking) || 'Авто не указано'}</span>
                    <span className="muted tnum">{formatMinutesUntil(booking.preferredAt)}</span>
                    <StatusBadge status={booking.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="На сегодня записей нет" description="Свободный день или другой фильтр." />
          )}
        </Card>
      )}

      {view === 'week' && (
        <>
          <Card>
            <header className="card-section-header">
              <h2>Загрузка на 7 дней</h2>
              <span className="muted tnum">пик: {capacityMax}</span>
            </header>
            <div className="booking-capacity-row">
              {Array.from({ length: 7 }).map((_, index) => {
                const day = new Date();
                day.setDate(day.getDate() + index);
                const key = day.toDateString();
                const count = capacityByDay.get(key) || 0;
                const pct = Math.round((count / capacityMax) * 100);
                return (
                  <div key={key} className={`booking-capacity-day${index === 0 ? ' is-today' : ''}`}>
                    <span>{day.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}</span>
                    <div className="booking-capacity-bar" aria-hidden>
                      <div className="booking-capacity-fill" style={{ height: `${Math.max(6, pct)}%` }} />
                    </div>
                    <em className="tnum">{count}</em>
                  </div>
                );
              })}
            </div>
          </Card>
          <BookingCalendar bookings={filteredBookings} onSelect={(booking) => setSelected(booking)} />
        </>
      )}

      {view === 'list' && (
        <Card>
          <header className="card-section-header">
            <h2>Все записи</h2>
            <span className="muted tnum">{filteredBookings.length}</span>
          </header>
          {filteredBookings.length ? (
            <ul className="booking-click-list">
              {filteredBookings.map((booking) => (
                <li key={booking.id}>
                  <button type="button" className="booking-list-btn" onClick={() => setSelected(booking)}>
                    <strong className="tnum">
                      {new Date(booking.preferredAt).toLocaleString('ru-RU')}
                    </strong>
                    <span>{booking.client?.fullName || booking.guestName || 'Клиент'}</span>
                    <span className="muted">{getBookingVehicleLabel(booking) || 'Авто не указано'}</span>
                    <StatusBadge status={booking.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Записей нет" description="Попробуйте другой фильтр." />
          )}
        </Card>
      )}

      <BookingDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        onUpdated={applyUpdatedBooking}
        showAudit={adminZone}
        requestBasePath={paths.requests}
      />
    </div>
  );
}
