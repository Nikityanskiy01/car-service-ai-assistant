import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarPlus,
  CarFront,
  ChevronRight,
  Clock3,
  MapPin,
  Phone,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cancelBooking, getBooking } from '../../../api/dashboard';
import { ClientStatusBadge } from '../../../components/client/ClientStatusBadge';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { buildBookingIcs, downloadBookingIcs } from '../../../lib/buildBookingIcs';
import {
  formatBookingCountdown,
  formatBookingDayParts,
} from '../../../lib/bookingCountdown';
import {
  formatBookingDateParts,
  getBookingSubtitle,
  getBookingTitle,
  getBookingVehicleLabel,
} from '../../../lib/bookingDisplay';
import {
  CLIENT_CALENDAR_FILE_HINT,
  clientBookingStatusDescription,
} from '../../../lib/clientStatusLabels';
import { resolveClientStatusTone } from '../../../lib/clientStatusLegend';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ServiceBooking } from '../../../types/dashboard';

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function caseLabel(booking: ServiceBooking) {
  const sr = booking.serviceRequest;
  if (!sr) return null;
  const car = [sr.snapshotMake, sr.snapshotModel].filter(Boolean).join(' ');
  if (car && sr.snapshotSymptoms) return `${car} — ${sr.snapshotSymptoms}`;
  return car || sr.snapshotSymptoms || 'Заявка';
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
  const canManage = Boolean(booking && !isCancelled && isUpcoming);
  const linkedCaseId = booking?.serviceRequestId || booking?.serviceRequest?.id;

  function handleAddToCalendar() {
    if (!booking) return;
    const ics = buildBookingIcs({
      id: booking.id,
      preferredAt: booking.preferredAt,
      title: `Визит — ${getBookingTitle(booking)} · ${productConfig.shortName}`,
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

  const title = getBookingTitle(booking);
  const subtitle = getBookingSubtitle(booking);
  const vehicle = getBookingVehicleLabel(booking);
  const parts = formatBookingDayParts(booking.preferredAt);
  const dateParts = formatBookingDateParts(booking.preferredAt);
  const countdown = formatBookingCountdown(booking.preferredAt);
  const tone = resolveClientStatusTone(booking.status);
  const linkedTitle = caseLabel(booking);
  const note = (booking.notes || booking.comment || '').trim();
  const statusHint = clientBookingStatusDescription(booking.status);

  return (
    <div className="stack dashboard-page booking-detail-page">
      <PageHeader
        title="Ваш визит"
        description={
          countdown && isUpcoming && !isCancelled
            ? `${countdown} · ${dateParts.short}`
            : dateParts.short
        }
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Записи', to: '/dashboard/client/bookings' },
          { label: 'Детали' },
        ]}
      />

      <article className="booking-detail" data-status-tone={tone}>
        <header className="booking-detail-hero">
          <div className="booking-detail-date" aria-hidden>
            <span className="booking-detail-date-num">{parts.day}</span>
            <span className="booking-detail-date-month">{parts.month}</span>
            {countdown ? (
              <span className="booking-detail-date-relative">{countdown}</span>
            ) : null}
          </div>

          <div className="booking-detail-hero-copy">
            <div className="booking-detail-hero-meta">
              <ClientStatusBadge status={booking.status} />
              {isCancelled ? (
                <span className="booking-detail-state-chip is-cancelled">Отменена</span>
              ) : !isUpcoming ? (
                <span className="booking-detail-state-chip is-past">Прошедший визит</span>
              ) : null}
            </div>

            <h2 className="booking-detail-title">
              {parts.weekday}, {parts.time}
            </h2>
            <p className="booking-detail-lead">{statusHint}</p>

            <div className="booking-detail-vehicle">
              <span className="booking-detail-vehicle-icon" aria-hidden>
                <CarFront size={18} />
              </span>
              <div>
                <strong>{title}</strong>
                {subtitle && subtitle !== title ? <span>{subtitle}</span> : null}
                {vehicle && title !== vehicle ? (
                  <span className="booking-detail-vehicle-hint">{vehicle}</span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="booking-detail-grid" aria-label="Подробности визита">
          <div className="booking-detail-panel">
            <h3>
              <MapPin size={16} aria-hidden />
              Куда ехать
            </h3>
            <dl className="booking-detail-facts">
              {productConfig.address ? (
                <div>
                  <dt>Адрес</dt>
                  <dd>
                    <span>{productConfig.address}</span>
                    {productConfig.mapUrl ? (
                      <a
                        className="booking-detail-inline-link"
                        href={productConfig.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть на карте
                      </a>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {productConfig.workingHours ? (
                <div>
                  <dt>
                    <Clock3 size={13} aria-hidden /> Режим работы
                  </dt>
                  <dd>{productConfig.workingHours}</dd>
                </div>
              ) : null}
              {productConfig.phone ? (
                <div>
                  <dt>
                    <Phone size={13} aria-hidden /> Телефон
                  </dt>
                  <dd>
                    <a className="booking-detail-inline-link" href={phoneHref(productConfig.phone)}>
                      {productConfig.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="booking-detail-quick">
              {productConfig.mapUrl ? (
                <a
                  className="btn btn-secondary booking-detail-quick-btn"
                  href={productConfig.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={16} aria-hidden />
                  Маршрут
                </a>
              ) : null}
              {productConfig.phone ? (
                <a
                  className="btn btn-secondary booking-detail-quick-btn"
                  href={phoneHref(productConfig.phone)}
                >
                  <Phone size={16} aria-hidden />
                  Позвонить
                </a>
              ) : null}
            </div>
          </div>

          <div className="booking-detail-panel">
            <h3>
              <CalendarDays size={16} aria-hidden />
              О визите
            </h3>
            {note ? (
              <p className="booking-detail-note">{note}</p>
            ) : (
              <p className="booking-detail-note is-empty">Комментарий к записи не указан.</p>
            )}

            {linkedCaseId && linkedTitle ? (
              <Link
                className="booking-detail-case-link"
                to={`/dashboard/client/cases/${linkedCaseId}`}
              >
                <div>
                  <span className="booking-detail-case-kicker">Связанное обращение</span>
                  <strong>{linkedTitle}</strong>
                </div>
                <ChevronRight size={18} aria-hidden />
              </Link>
            ) : null}
          </div>
        </section>

        <footer className="booking-detail-actions" aria-label="Действия с записью">
          <Button
            type="button"
            variant="primary"
            className="booking-detail-action-primary"
            onClick={handleAddToCalendar}
            title={CLIENT_CALENDAR_FILE_HINT}
          >
            <CalendarPlus size={17} aria-hidden />
            В календарь
          </Button>

          {canManage ? (
            <>
              <Button type="button" variant="secondary" onClick={handleReschedule}>
                <RefreshCw size={16} aria-hidden />
                Перенести
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleCancel()}
                disabled={cancelling}
              >
                <XCircle size={16} aria-hidden />
                {cancelling ? 'Отмена…' : 'Отменить'}
              </Button>
            </>
          ) : null}

          {isCancelled || !isUpcoming ? (
            <Button type="button" variant="secondary" onClick={() => navigate('/booking')}>
              <CalendarDays size={16} aria-hidden />
              Записаться снова
            </Button>
          ) : null}
        </footer>

        {actionError ? <p className="form-error booking-detail-error">{actionError}</p> : null}
        <p className="booking-detail-hint">{CLIENT_CALENDAR_FILE_HINT}</p>
      </article>
    </div>
  );
}
