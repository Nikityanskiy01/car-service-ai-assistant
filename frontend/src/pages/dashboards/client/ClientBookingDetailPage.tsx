import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CarFront,
  ChevronRight,
  Clock3,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cancelBooking, getBooking } from '../../../api/dashboard';
import { BookingStatusRail } from '../../../components/client/BookingStatusRail';
import { ClientStatusBadge } from '../../../components/client/ClientStatusBadge';
import { RescheduleBookingModal } from '../../../components/client/RescheduleBookingModal';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { useProductConfig } from '../../../config/ProductConfigProvider';
import { buildBookingIcs, downloadBookingIcs } from '../../../lib/buildBookingIcs';
import { formatBookingDayParts } from '../../../lib/bookingCountdown';
import { resolveBookingUiContext } from '../../../lib/bookingUiContext';
import { getBookingSubtitle, getBookingTitle } from '../../../lib/bookingDisplay';
import {
  CLIENT_CALENDAR_FILE_HINT,
  clientBookingStatusDescription,
} from '../../../lib/clientStatusLabels';
import { resolveClientStatusTone } from '../../../lib/clientStatusLegend';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ServiceBooking } from '../../../types/dashboard';

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function ClientBookingDetailPage() {
  const { bookingId = '' } = useParams();
  const navigate = useNavigate();
  const productConfig = useProductConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  usePageMeta({ title: 'Детали записи', description: 'Дата записи, статус и действия.' });

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

  const linkedCaseId = booking?.serviceRequestId || booking?.serviceRequest?.id;

  function handleAddToCalendar() {
    if (!booking) return;
    const ics = buildBookingIcs({
      id: booking.id,
      preferredAt: booking.preferredAt,
      title: `Запись — ${getBookingTitle(booking)} · ${productConfig.shortName}`,
      location: productConfig.address,
    });
    downloadBookingIcs(ics, `booking-${booking.id}.ics`);
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
  const parts = formatBookingDayParts(booking.preferredAt);
  const ui = resolveBookingUiContext(booking.preferredAt, booking.status);
  const tone = resolveClientStatusTone(booking.status);
  const note = (booking.notes || booking.comment || '').trim();
  const statusHint = clientBookingStatusDescription(booking.status);
  const showDistinctNote = Boolean(note && note !== subtitle && note !== title);
  const hasLocation =
    Boolean(productConfig.address) ||
    Boolean(productConfig.workingHours) ||
    Boolean(productConfig.phone);
  const calendarHint = ui.showCalendarPrimary
    ? CLIENT_CALENDAR_FILE_HINT
    : 'Время ещё не подтверждено — файл можно сохранить как напоминание о запросе.';
  const showCalendarHint =
    ui.showCalendarPrimary || (ui.showCalendar && !ui.showCalendarPrimary);

  return (
    <div className="stack dashboard-page booking-detail-page">
      <nav className="booking-detail-nav" aria-label="Навигация">
        <Link className="booking-detail-back" to="/dashboard/client/bookings">
          <ArrowLeft size={16} aria-hidden />
          Записи
        </Link>
      </nav>

      <article className="booking-detail" data-status-tone={tone}>
        <header className="booking-detail-hero">
          <div className="booking-detail-hero-main">
            <div className="booking-detail-date" aria-hidden>
              <span className="booking-detail-date-num">{parts.day}</span>
              <span className="booking-detail-date-month">{parts.month}</span>
              {ui.dateBadge ? (
                <span
                  className={`booking-detail-date-relative${ui.showPastChip ? ' is-past' : ''}${booking.status === 'PENDING' ? ' is-pending' : ''}`}
                >
                  {ui.dateBadge}
                </span>
              ) : null}
            </div>

            <div className="booking-detail-hero-copy">
              <div className="booking-detail-hero-meta">
                <ClientStatusBadge status={booking.status} />
                {booking.status === 'CANCELLED' ? (
                  <span className="booking-detail-state-chip is-cancelled">Отменена</span>
                ) : ui.showPastChip ? (
                  <span className="booking-detail-state-chip is-past">Прошедшая</span>
                ) : null}
              </div>
              <h1 className="booking-detail-title">
                {parts.weekday}, {parts.time}
              </h1>
              <p className="booking-detail-lead">{statusHint}</p>
            </div>
          </div>

          <BookingStatusRail status={booking.status} />
        </header>

        {booking.status === 'PENDING' ? (
          <div className="booking-detail-note is-agree" role="status">
            <span className="booking-detail-note-label">Важно</span>
            <p>Сначала согласуйте время с сервисом. До подтверждения запись не окончательная.</p>
          </div>
        ) : null}

        {(title || subtitle) && (
          <div className="booking-detail-service">
            <span className="booking-detail-service-icon" aria-hidden>
              <CarFront size={18} />
            </span>
            <div>
              {title ? <strong>{title}</strong> : null}
              {subtitle && subtitle !== title ? <span>{subtitle}</span> : null}
            </div>
          </div>
        )}

        <section className="booking-detail-grid" aria-label="Подробности записи">
          {hasLocation ? (
            <div className="booking-detail-panel">
              <h2>
                <MapPin size={16} aria-hidden />
                Куда ехать
              </h2>
              <ul className="booking-detail-facts">
                {productConfig.address ? (
                  <li className="booking-detail-fact">
                    <span className="booking-detail-fact-icon" aria-hidden>
                      <MapPin size={15} />
                    </span>
                    <div>
                      <span className="booking-detail-fact-label">Адрес</span>
                      <strong>{productConfig.address}</strong>
                      {productConfig.mapUrl ? (
                        <a
                          className="booking-detail-inline-link"
                          href={productConfig.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          На карте
                        </a>
                      ) : null}
                    </div>
                  </li>
                ) : null}
                {productConfig.workingHours ? (
                  <li className="booking-detail-fact">
                    <span className="booking-detail-fact-icon" aria-hidden>
                      <Clock3 size={15} />
                    </span>
                    <div>
                      <span className="booking-detail-fact-label">Режим работы</span>
                      <strong>{productConfig.workingHours}</strong>
                    </div>
                  </li>
                ) : null}
                {productConfig.phone ? (
                  <li className="booking-detail-fact">
                    <span className="booking-detail-fact-icon" aria-hidden>
                      <Phone size={15} />
                    </span>
                    <div>
                      <span className="booking-detail-fact-label">Телефон</span>
                      <a className="booking-detail-inline-link is-strong" href={phoneHref(productConfig.phone)}>
                        {productConfig.phone}
                      </a>
                    </div>
                  </li>
                ) : null}
              </ul>
              <div className="booking-detail-quick">
                {productConfig.mapUrl ? (
                  <a
                    className="booking-toolbar-btn"
                    href={productConfig.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={15} aria-hidden />
                    Маршрут
                  </a>
                ) : null}
                {productConfig.phone ? (
                  <a className="booking-toolbar-btn" href={phoneHref(productConfig.phone)}>
                    <Phone size={15} aria-hidden />
                    Позвонить
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="booking-detail-panel">
            <h2>
              <CalendarDays size={16} aria-hidden />
              Детали
            </h2>

            {booking.serviceName ? (
              <div className="booking-detail-highlight">
                <span>Услуга</span>
                <strong>{booking.serviceName}</strong>
              </div>
            ) : null}

            {showDistinctNote ? (
              <div className="booking-detail-note">
                <span className="booking-detail-note-label">Комментарий</span>
                <p>{note}</p>
              </div>
            ) : (
              <p className="booking-detail-note is-empty">Комментарий не указан</p>
            )}

            {linkedCaseId ? (
              <Link className="booking-detail-case-link" to={`/dashboard/client/cases/${linkedCaseId}`}>
                <span className="booking-detail-case-icon" aria-hidden>
                  <MessageSquare size={16} />
                </span>
                <div>
                  <span className="booking-detail-case-kicker">Обращение</span>
                  <strong>Переписка и статус ремонта</strong>
                </div>
                <ChevronRight size={18} aria-hidden />
              </Link>
            ) : null}
          </div>
        </section>

        <footer className="booking-detail-toolbar" aria-label="Действия с записью">
          <div className="booking-detail-toolbar-row">
            {ui.showCallPrimary && productConfig.phone ? (
              <a className="booking-toolbar-btn is-accent" href={phoneHref(productConfig.phone)}>
                <Phone size={15} aria-hidden />
                Позвонить
              </a>
            ) : null}

            {ui.canManage ? (
              <button type="button" className="booking-toolbar-btn" onClick={() => setRescheduleOpen(true)}>
                <RefreshCw size={15} aria-hidden />
                Перенести
              </button>
            ) : null}

            {ui.showCalendarPrimary || (ui.showCalendar && !ui.showCalendarPrimary) ? (
              <button type="button" className="booking-toolbar-btn" onClick={handleAddToCalendar} title={CLIENT_CALENDAR_FILE_HINT}>
                <CalendarPlus size={15} aria-hidden />
                В календарь
              </button>
            ) : null}

            {ui.showBookAgain ? (
              <Button type="button" variant="secondary" className="booking-toolbar-btn" onClick={() => navigate('/booking')}>
                <CalendarDays size={15} aria-hidden />
                Записаться снова
              </Button>
            ) : null}

            {ui.canManage ? (
              <button
                type="button"
                className="booking-toolbar-btn is-danger"
                onClick={() => void handleCancel()}
                disabled={cancelling}
              >
                <X size={15} aria-hidden />
                {cancelling ? 'Отмена…' : 'Отменить'}
              </button>
            ) : null}
          </div>

          {showCalendarHint ? <p className="booking-detail-hint">{calendarHint}</p> : null}
          {actionError ? <p className="form-error booking-detail-error">{actionError}</p> : null}
        </footer>
      </article>

      <RescheduleBookingModal
        open={rescheduleOpen}
        booking={booking}
        onClose={() => setRescheduleOpen(false)}
        onUpdated={setBooking}
      />
    </div>
  );
}
