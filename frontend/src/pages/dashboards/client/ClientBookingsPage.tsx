import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { listBookings } from '../../../api/dashboard';
import { BookingCard } from '../../../components/client/BookingCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { parseBookingTab, type BookingTab } from '../../../lib/bookingTabs';
import { formatBookingDateParts, getBookingSubtitle, getBookingTitle } from '../../../lib/bookingDisplay';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ServiceBooking } from '../../../types/dashboard';

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

function filterBookings(bookings: ServiceBooking[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return bookings;
  return bookings.filter((booking) => {
    const haystack = [
      getBookingTitle(booking),
      getBookingSubtitle(booking),
      booking.notes,
      booking.comment,
      formatBookingDateParts(booking.preferredAt).day,
      formatBookingDateParts(booking.preferredAt).time,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function ClientBookingsPage() {
  usePageMeta({ title: 'Мои записи', description: 'Записи на обслуживание.' });
  const productConfig = useProductConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const createdBookingId = searchParams.get('created');
  const tab = parseBookingTab(searchParams.get('tab'));
  const [search, setSearch] = useState('');
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

  const shown = useMemo(() => {
    const base = tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled;
    return filterBookings(base, search);
  }, [tab, upcoming, past, cancelled, search]);

  function setTab(next: BookingTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  const emptyCopy: Record<BookingTab, { title: string; description: string }> = {
    upcoming: {
      title: 'Нет предстоящих записей',
      description: 'Запишитесь на удобное время — запись появится здесь с напоминанием и деталями.',
    },
    past: {
      title: 'История пуста',
      description: 'Завершённые записи сохраняются в этой вкладке.',
    },
    cancelled: {
      title: 'Отменённых записей нет',
      description: 'Отменённые записи остаются здесь для истории.',
    },
  };

  if (loading) return <Loader label="Загружаем записи..." />;
  if (error) return <ErrorState message={error} />;

  const featuredId = tab === 'upcoming' && shown.length > 0 ? shown[0].id : null;

  return (
    <div className="stack dashboard-page client-bookings-page">
      <PageHeader
        title="Мои записи"
        description="Предстоящие, прошедшие и отменённые записи в сервис."
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Записи' },
        ]}
        actions={
          <Link className="btn btn-primary" to="/booking">
            Записаться
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

      <div className="booking-toolbar">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по дате, авто или комментарию"
          aria-label="Поиск записей"
        />
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Ничего не найдено' : emptyCopy[tab].title}
            description={search ? 'Попробуйте другой запрос или сбросьте фильтр.' : emptyCopy[tab].description}
            action={
              tab === 'upcoming' ? (
                <Link className="btn btn-primary" to="/booking">
                  Записаться в сервис
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="booking-card-list">
          {shown.map((item) => (
            <BookingCard
              key={item.id}
              booking={item}
              variant={tab}
              serviceAddress={productConfig.address || undefined}
              featured={item.id === featuredId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
