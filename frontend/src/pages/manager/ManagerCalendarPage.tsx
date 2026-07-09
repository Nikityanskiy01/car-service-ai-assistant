import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBookings } from '../../api/dashboard';
import { BookingCalendar } from '../../components/requests/BookingCalendar';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceBooking } from '../../types/dashboard';

export function ManagerCalendarPage() {
  usePageMeta({ title: 'Календарь', description: 'Записи на обслуживание.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [view, setView] = useState('week');

  useEffect(() => {
    void listBookings()
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toDateString();
  const todayBookings = bookings.filter((b) => new Date(b.preferredAt).toDateString() === today);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Календарь"
        description="Запланированные визиты и записи клиентов."
        breadcrumbs={[
          { label: 'Рабочий стол', to: '/dashboard/manager' },
          { label: 'Календарь' },
        ]}
        actions={
          <Link to="/booking">
            <span className="btn btn-secondary">Создать запись</span>
          </Link>
        }
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
          <ul className="simple-list">
            {todayBookings.map((b) => (
              <li key={b.id}>
                <strong>{new Date(b.preferredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</strong>
                <span>{b.client?.fullName || b.guestName || 'Клиент'}</span>
                <StatusBadge status={b.status} />
              </li>
            ))}
            {!todayBookings.length ? <p className="muted">На сегодня записей нет.</p> : null}
          </ul>
        </Card>
      )}

      {(view === 'week' || view === 'list') && <BookingCalendar bookings={bookings} />}

      {view === 'list' && (
        <Card>
          <h2>Все записи</h2>
          <ul className="simple-list">
            {bookings.map((b) => (
              <li key={b.id}>
                <strong>{new Date(b.preferredAt).toLocaleString('ru-RU')}</strong>
                <span>{b.client?.fullName || b.guestName || 'Клиент'}</span>
                <StatusBadge status={b.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
