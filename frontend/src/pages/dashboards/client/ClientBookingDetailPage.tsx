import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, MapPin, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cancelBooking, getBooking } from '../../../api/dashboard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { buildBookingIcs, downloadBookingIcs } from '../../../lib/buildBookingIcs';
import { clientBookingStatusLabel } from '../../../lib/clientStatusLabels';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ServiceBooking } from '../../../types/dashboard';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function caseLabel(booking: ServiceBooking) {
  const sr = booking.serviceRequest;
  if (!sr) return null;
  const car = [sr.snapshotMake, sr.snapshotModel].filter(Boolean).join(' ');
  if (car && sr.snapshotSymptoms) return `${car} — ${sr.snapshotSymptoms}`;
  return car || sr.snapshotSymptoms || `Заявка`;
}

export function ClientBookingDetailPage() {
  const { bookingId = '' } = useParams();
  const navigate = useNavigate();
  const productConfig = useProductConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  usePageMeta({ title: 'Детали записи', description: 'Дата визита, статус и действия.' });

  async function load() {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      setBooking(await getBooking(bookingId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить запись');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [bookingId]);

  const isCancelled = booking?.status === 'CANCELLED';
  const isUpcoming = booking ? new Date(booking.preferredAt).getTime() > Date.now() : false;
  const linkedCaseId = booking?.serviceRequestId || booking?.serviceRequest?.id;

  function handleAddToCalendar() {
    if (!booking) return;
    const ics = buildBookingIcs({
      id: booking.id,
      preferredAt: booking.preferredAt,
      title: `Визит — ${productConfig.shortName}`,
      location: productConfig.address,
      description: booking.notes || booking.comment || undefined,
    });
    downloadBookingIcs(ics, `booking-${booking.id}.ics`);
  }

  function handleReschedule() {
    if (!booking) return;
    sessionStorage.setItem(
      STORAGE_KEYS.bookingPrefill,
      JSON.stringify({
        serviceRequestId: linkedCaseId || undefined,
        consultationSummary: booking.notes || booking.comment || undefined,
        fullName: booking.client?.fullName || undefined,
        phone: booking.client?.phone || undefined,
      }),
    );
    navigate('/booking');
  }

  async function handleCancel() {
    if (!booking || !window.confirm('Отменить запись? Менеджер получит уведомление.')) return;
    setCancelling(true);
    setActionError(null);
    try {
      const updated = await cancelBooking(booking.id);
      setBooking(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось отменить запись');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Loader label="Загружаем запись..." />;
  if (error || !booking) {
    return <ErrorState message={error || 'Запись не найдена'} onRetry={() => void load()} />;
  }

  const caseTitle = caseLabel(booking);

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Детали записи"
        description={formatDate(booking.preferredAt)}
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Записи', to: '/dashboard/client/bookings' },
          { label: 'Детали' },
        ]}
      />

      <Card className="booking-detail-card">
        <div className="booking-detail-head">
          <span className="booking-detail-icon" aria-hidden>
            <CalendarDays size={22} />
          </span>
          <div>
            <h2>{formatDate(booking.preferredAt)}</h2>
            <StatusBadge status={booking.status} />
          </div>
        </div>

        <dl className="booking-detail-meta">
          <div>
            <dt>Статус</dt>
            <dd>{clientBookingStatusLabel(booking.status)}</dd>
          </div>
          {productConfig.address ? (
            <div>
              <dt>
                <MapPin size={14} aria-hidden /> Адрес
              </dt>
              <dd>
                {productConfig.address}
                {productConfig.mapUrl ? (
                  <>
                    {' '}
                    <a href={productConfig.mapUrl} target="_blank" rel="noreferrer">
                      На карте
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          ) : null}
          {productConfig.workingHours ? (
            <div>
              <dt>Режим работы</dt>
              <dd>{productConfig.workingHours}</dd>
            </div>
          ) : null}
          {booking.notes || booking.comment ? (
            <div>
              <dt>
                <MessageSquare size={14} aria-hidden /> Комментарий
              </dt>
              <dd>{booking.notes || booking.comment}</dd>
            </div>
          ) : null}
          {linkedCaseId && caseTitle ? (
            <div>
              <dt>Связанное обращение</dt>
              <dd>
                <Link to={`/dashboard/client/cases/${linkedCaseId}`}>{caseTitle}</Link>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="booking-detail-actions">
          <Button type="button" variant="secondary" onClick={handleAddToCalendar}>
            Добавить в календарь (.ics)
          </Button>
          {!isCancelled && isUpcoming ? (
            <>
              <Button type="button" variant="ghost" onClick={handleReschedule}>
                Перенести
              </Button>
              <Button type="button" variant="ghost" onClick={() => void handleCancel()} disabled={cancelling}>
                {cancelling ? 'Отмена...' : 'Отменить запись'}
              </Button>
            </>
          ) : null}
        </div>
        {actionError ? <p className="form-error">{actionError}</p> : null}
      </Card>
    </div>
  );
}
