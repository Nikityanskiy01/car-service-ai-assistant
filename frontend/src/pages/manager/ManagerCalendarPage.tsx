import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getCachedUser } from '../../api/client';
import { listBookings } from '../../api/dashboard';
import {
  BookingCalendar,
  BookingCalendarLegend,
  BookingEventCard,
} from '../../components/requests/BookingCalendar';
import { BookingDrawer } from '../../components/requests/BookingDrawer';
import { Button } from '../../components/ui/Button';
import { managerZonePaths } from '../../config/managerPaths';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  addDays,
  daysInRange,
  formatRangeLabel,
  isoDay,
  isSameLocalDay,
  startOfLocalDay,
} from '../../lib/calendarDays';
import type { ServiceBooking } from '../../types/dashboard';

type ManagerCalendarPageProps = {
  adminZone?: boolean;
};

type CalendarFilter = 'all' | 'today' | 'mine' | 'with-request' | 'unconfirmed';
type CalendarView = 'day' | 'week' | 'list';

const OPEN_STATUSES = ['PENDING', 'CONFIRMED'];

const FILTERS: { id: CalendarFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'today', label: 'Сегодня' },
  { id: 'mine', label: 'Мои' },
  { id: 'unconfirmed', label: 'Без подтверждения' },
  { id: 'with-request', label: 'С заявкой' },
];

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'list', label: 'Список' },
];

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
  const [rangeStart, setRangeStart] = useState(() => startOfLocalDay(new Date()));
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

  const today = startOfLocalDay(new Date());
  const rangeDays = view === 'day' ? 1 : 7;
  const isCurrentRange = rangeStart.getTime() === today.getTime();

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (calendarFilter === 'today') {
      list = list.filter((booking) => isSameLocalDay(new Date(booking.preferredAt), today));
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

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      today: bookings.filter((booking) => isSameLocalDay(new Date(booking.preferredAt), today)).length,
      pending: bookings.filter((booking) => booking.status === 'PENDING').length,
      upcoming: bookings.filter(
        (booking) =>
          OPEN_STATUSES.includes(booking.status) && new Date(booking.preferredAt).getTime() > now,
      ).length,
    };
  }, [bookings, today]);

  const weekDays = useMemo(() => daysInRange(rangeStart, 7), [rangeStart]);

  const capacityByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of filteredBookings) {
      const key = isoDay(new Date(booking.preferredAt));
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [filteredBookings]);

  const capacityMax = Math.max(...Array.from(capacityByDay.values()), 1);

  function applyUpdatedBooking(updated: ServiceBooking) {
    setBookings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  }

  function shiftRange(amount: number) {
    setRangeStart((prev) => addDays(prev, amount));
  }

  function goToday() {
    setRangeStart(startOfLocalDay(new Date()));
  }

  function openDay(date: Date) {
    setRangeStart(startOfLocalDay(date));
    setView('day');
  }

  function scrollToDay(date: Date) {
    const node = document.getElementById(`cal-day-${isoDay(date)}`);
    node?.scrollIntoView({ inline: 'start', block: 'nearest' });
  }

  return (
    <div className="calendar-page">
      <div className="calendar-toolbar">
        <p className="muted">Запланированные визиты и загрузка постов.</p>
        <div className="row gap-sm">
          <Button type="button" variant="ghost" onClick={() => void load()}>
            <RefreshCw size={16} />
            Обновить
          </Button>
          <Link className="btn btn-primary" to="/booking">
            <CalendarPlus size={16} />
            Создать запись
          </Link>
        </div>
      </div>

      {error ? (
        <div className="error-text" role="alert">
          <p>Не удалось загрузить записи. {error}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Повторить
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div aria-busy="true">
          <div className="skeleton calendar-stat-row" />
          <div className="skeleton" style={{ minHeight: '16rem', marginTop: '0.75rem' }} />
        </div>
      ) : null}

      {!loading && !error ? (
        <>
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

          <div className="calendar-controls">
            <div className="queue-status-pills" role="toolbar" aria-label="Фильтр записей">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`queue-status-pill${calendarFilter === item.id ? ' is-active' : ''}`}
                  aria-pressed={calendarFilter === item.id}
                  onClick={() => setCalendarFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="queue-status-pills" role="toolbar" aria-label="Вид календаря">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`queue-status-pill${view === item.id ? ' is-active' : ''}`}
                  aria-pressed={view === item.id}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {view !== 'list' ? (
            <div className="calendar-range-nav">
              <Button
                type="button"
                variant="ghost"
                aria-label={view === 'day' ? 'Предыдущий день' : 'Предыдущие 7 дней'}
                onClick={() => shiftRange(-rangeDays)}
              >
                <ChevronLeft size={18} />
              </Button>
              <div className="calendar-range-copy">
                <strong>{formatRangeLabel(rangeStart, rangeDays)}</strong>
                {isCurrentRange ? null : (
                  <button type="button" className="calendar-today-link" onClick={goToday}>
                    К сегодня
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label={view === 'day' ? 'Следующий день' : 'Следующие 7 дней'}
                onClick={() => shiftRange(rangeDays)}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          ) : null}

          <BookingCalendarLegend />

          {view === 'week' ? (
            <>
              <section className="calendar-capacity" aria-label="Загрузка на 7 дней">
                <header className="booking-day-header">
                  <h4>Загрузка на 7 дней</h4>
                  <span className="muted tnum">пик: {capacityMax}</span>
                </header>
                <div className="booking-capacity-row">
                  {weekDays.map((day) => {
                    const key = isoDay(day);
                    const count = capacityByDay.get(key) || 0;
                    const pct = Math.round((count / capacityMax) * 100);
                    const todayBar = isSameLocalDay(day, today);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`booking-capacity-day${todayBar ? ' is-today' : ''}`}
                        onClick={() => scrollToDay(day)}
                        aria-label={`${day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric' })}: ${count} записей`}
                      >
                        <em className="tnum">{count}</em>
                        <div className="booking-capacity-bar">
                          <div
                            className="booking-capacity-fill"
                            style={{ height: `${Math.max(count ? 12 : 8, pct)}%`, opacity: todayBar ? 1 : 0.55 }}
                          />
                        </div>
                        <span className="muted">
                          {day.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <BookingCalendar
                bookings={filteredBookings}
                onSelect={setSelected}
                startDate={rangeStart}
                dayCount={7}
                onOpenDay={openDay}
              />
            </>
          ) : null}

          {view === 'day' ? (
            <BookingCalendar
              bookings={filteredBookings}
              onSelect={setSelected}
              startDate={rangeStart}
              dayCount={1}
            />
          ) : null}

          {view === 'list' ? (
            <section>
              <header className="booking-day-header">
                <h4>Все записи</h4>
                <span className="muted tnum">{filteredBookings.length}</span>
              </header>
              {filteredBookings.length ? (
                <ul className="booking-week-list is-page">
                  {filteredBookings.map((booking) => (
                    <li key={booking.id}>
                      <BookingEventCard booking={booking} onSelect={setSelected} layout="row" showDate />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Попробуйте другой фильтр.</p>
              )}
            </section>
          ) : null}
        </>
      ) : null}

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
