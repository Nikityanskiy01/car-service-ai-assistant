import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { listBookings } from '../../../api/dashboard';
import { DashboardRecordCard } from '../../../components/dashboard/DashboardRecordCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import { parseBookingTab, type BookingTab } from '../../../lib/bookingTabs';
import { clientBookingStatusLabel } from '../../../lib/clientStatusLabels';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ServiceBooking } from '../../../types/dashboard';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function partitionBookings(bookings: ServiceBooking[]) {
  const now = Date.now();
  const upcoming: ServiceBooking[] = [];
  const past: ServiceBooking[] = [];
  const cancelled: ServiceBooking[] = [];

  for (const booking of bookings) {
    if (booking.status === 'CANCELLED') {
      cancelled.push(booking);
      continue;
    }
    if (new Date(booking.preferredAt).getTime() >= now - 3600000) upcoming.push(booking);
    else past.push(booking);
  }

  upcoming.sort((a, b) => new Date(a.preferredAt).getTime() - new Date(b.preferredAt).getTime());
  past.sort((a, b) => new Date(b.preferredAt).getTime() - new Date(a.preferredAt).getTime());
  cancelled.sort((a, b) => new Date(b.preferredAt).getTime() - new Date(a.preferredAt).getTime());

  return { upcoming, past, cancelled };
}

export function ClientBookingsPage() {
  usePageMeta({ title: 'Мои записи', description: 'Записи на обслуживание.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const createdBookingId = searchParams.get('created');
  const tab = parseBookingTab(searchParams.get('tab'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setBookings(await listBookings());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки записей');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { upcoming, past, cancelled } = useMemo(() => partitionBookings(bookings), [bookings]);

  const shown =
    tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled;

  function setTab(next: BookingTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  const emptyCopy: Record<BookingTab, { title: string; description: string }> = {
    upcoming: {
      title: 'Нет предстоящих записей',
      description: 'Выберите услугу и удобное время визита.',
    },
    past: {
      title: 'История пуста',
      description: 'Завершённые визиты появятся здесь.',
    },
    cancelled: {
      title: 'Отменённых записей нет',
      description: 'Отменённые визиты сохраняются в этой вкладке.',
    },
  };

  if (loading) return <Loader label="Загружаем записи..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Мои записи"
        description="Предстоящие, прошедшие и отменённые визиты."
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Записи' },
        ]}
        actions={
          <Link className="btn btn-primary" to="/booking">
            Новая запись
          </Link>
        }
      />

      {createdBookingId ? (
        <div className="form-status is-success" role="status">
          Запись создана.{' '}
          <Link to={`/dashboard/client/bookings/${createdBookingId}`}>Открыть детали</Link>
          {' · '}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              searchParams.delete('created');
              setSearchParams(searchParams, { replace: true });
            }}
          >
            Закрыть
          </button>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onChange={(next) => setTab(next as BookingTab)}
        items={[
          { id: 'upcoming', label: `Предстоящие (${upcoming.length})` },
          { id: 'past', label: `Прошедшие (${past.length})` },
          { id: 'cancelled', label: `Отменённые (${cancelled.length})` },
        ]}
      />

      <Card>
        {shown.length === 0 ? (
          <EmptyState title={emptyCopy[tab].title} description={emptyCopy[tab].description} />
        ) : (
          <div className="desk-record-list">
            {shown.map((item) => (
              <DashboardRecordCard
                key={item.id}
                title={formatDate(item.preferredAt)}
                subtitle={item.notes || item.comment || 'Без комментария'}
                meta={clientBookingStatusLabel(item.status)}
                status={item.status}
                icon={CalendarDays}
                to={`/dashboard/client/bookings/${item.id}`}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
