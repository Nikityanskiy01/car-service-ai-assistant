import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CarFront, ChevronRight, Phone, X } from 'lucide-react';
import { getBookingAudit, patchBooking, type BookingAuditEntry } from '../../api/dashboard';
import {
  formatBookingDateParts,
  formatBookingRelative,
  formatBookingRequestSummary,
  getBookingVehicleLabel,
} from '../../lib/bookingDisplay';
import { Button } from '../ui/Button';
import { CopyPhoneButton } from '../ui/CopyPhoneButton';
import { Loader } from '../ui/Loader';
import { StatusBadge } from '../ui/StatusBadge';
import { useToast } from '../ui/toastContext';
import type { ServiceBooking } from '../../types/dashboard';

type BookingStatus = 'CONFIRMED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED';

type Props = {
  booking: ServiceBooking | null;
  onClose: () => void;
  onUpdated?: (booking: ServiceBooking) => void;
  showAudit?: boolean;
  requestBasePath?: string;
};

const STATUS_TOASTS: Record<BookingStatus, string> = {
  CONFIRMED: 'Запись подтверждена',
  ARRIVED: 'Отмечен приезд клиента',
  NO_SHOW: 'Отмечена неявка',
  CANCELLED: 'Запись отменена',
};

const VISIT_ACTIONS: Array<{ status: BookingStatus; label: string; variant: 'secondary' | 'ghost' }> = [
  { status: 'ARRIVED', label: 'Приехал', variant: 'secondary' },
  { status: 'NO_SHOW', label: 'Не приехал', variant: 'ghost' },
];

function bookingTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'ARRIVED') return 'arrived';
  if (normalized === 'NO_SHOW') return 'missed';
  if (normalized === 'CANCELLED') return 'cancelled';
  if (normalized === 'CONFIRMED') return 'confirmed';
  return 'waiting';
}

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function BookingDrawer({
  booking,
  onClose,
  onUpdated,
  showAudit = false,
  requestBasePath = '/dashboard/manager/requests',
}: Props) {
  const { success, error: toastError } = useToast();
  const [audit, setAudit] = useState<BookingAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  const bookingId = booking?.id;
  const preferredAt = booking?.preferredAt;

  useEffect(() => {
    if (!preferredAt) return;
    setRescheduleAt(toLocalInputValue(preferredAt));
  }, [bookingId, preferredAt]);

  useEffect(() => {
    if (!bookingId || !showAudit) {
      setAudit([]);
      return;
    }
    setAuditLoading(true);
    void getBookingAudit(bookingId)
      .then(setAudit)
      .catch(() => setAudit([]))
      .finally(() => setAuditLoading(false));
  }, [bookingId, showAudit]);

  useEffect(() => {
    if (!bookingId) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bookingId, onClose]);

  if (!booking) return null;

  const name = booking.client?.fullName || booking.guestName || 'Клиент';
  const phone = booking.client?.phone || booking.guestPhone || '';
  const serviceRequest = booking.serviceRequest;
  const car = getBookingVehicleLabel(booking) || '';
  const plate = booking.vehicle?.licensePlate?.trim() || '';
  const year = booking.vehicle?.year ? String(booking.vehicle.year) : '';
  const carMeta = [year, plate].filter(Boolean).join(' · ');
  const when = formatBookingDateParts(booking.preferredAt);
  const relative = formatBookingRelative(booking.preferredAt);
  const rescheduleChanged = rescheduleAt !== toLocalInputValue(booking.preferredAt);
  const showConfirm = booking.status !== 'CONFIRMED';
  const showCancel = booking.status !== 'CANCELLED';
  const visitActions = VISIT_ACTIONS.filter((action) => action.status !== booking.status);

  async function updateStatus(status: BookingStatus) {
    if (!booking) return;
    setBusy(true);
    try {
      const updated = await patchBooking(booking.id, { status });
      onUpdated?.(updated);
      success(STATUS_TOASTS[status]);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Не удалось изменить статус записи');
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!booking || !rescheduleAt) return;
    const next = new Date(rescheduleAt);
    if (Number.isNaN(next.getTime())) {
      toastError('Некорректная дата переноса');
      return;
    }
    setBusy(true);
    try {
      const updated = await patchBooking(booking.id, { preferredAt: next.toISOString() });
      onUpdated?.(updated);
      success('Запись перенесена', {
        description: next.toLocaleString('ru-RU'),
      });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Не удалось перенести запись');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="booking-drawer"
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        data-status-tone={bookingTone(booking.status)}
        aria-label={`Запись ${when.short}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="booking-drawer-header">
          <div className="booking-drawer-heading">
            <p className="booking-drawer-kicker">Запись</p>
            <h2>{name}</h2>
            <p className="booking-drawer-when">
              <time dateTime={booking.preferredAt} className="tnum">
                {when.day}, {when.time}
              </time>
              {relative ? <span className="booking-drawer-relative">{relative}</span> : null}
            </p>
          </div>
          <div className="booking-drawer-header-aside">
            <StatusBadge status={booking.status} />
            <button
              ref={closeRef}
              type="button"
              className="btn btn-ghost btn-icon booking-drawer-close"
              onClick={onClose}
              aria-label="Закрыть (Esc)"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className="booking-drawer-body">
          {phone || car ? (
            <div className="booking-drawer-facts">
              {phone ? (
                <div className="booking-drawer-fact">
                  <span className="booking-drawer-fact-label">Телефон</span>
                  <span className="booking-drawer-phone">
                    <a href={`tel:${phone}`} className="tnum">
                      {phone}
                    </a>
                    <CopyPhoneButton phone={phone} label="" />
                  </span>
                </div>
              ) : null}
              {car ? (
                <div className="booking-drawer-fact">
                  <span className="booking-drawer-fact-label">
                    <CarFront size={12} aria-hidden />
                    Автомобиль
                  </span>
                  <span className="booking-drawer-fact-value">{car}</span>
                  {carMeta ? <span className="booking-drawer-fact-meta">{carMeta}</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {booking.notes || serviceRequest?.snapshotSymptoms ? (
            <section className="booking-drawer-notes" aria-label="Детали визита">
              {booking.notes ? (
                <div>
                  <h3>Комментарий</h3>
                  <p>{booking.notes}</p>
                </div>
              ) : null}
              {serviceRequest?.snapshotSymptoms ? (
                <div>
                  <h3>Симптомы</h3>
                  <p>{serviceRequest.snapshotSymptoms}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {serviceRequest ? (
            <Link to={`${requestBasePath}/${serviceRequest.id}`} className="booking-drawer-request">
              <span>
                <span className="booking-drawer-fact-label">Заявка</span>
                <strong>{formatBookingRequestSummary(serviceRequest)}</strong>
              </span>
              <ChevronRight size={18} aria-hidden />
            </Link>
          ) : null}

          <div className="booking-reschedule">
            <label htmlFor="booking-reschedule-input">
              <CalendarClock size={14} aria-hidden />
              Перенести на
            </label>
            <div className="booking-reschedule-row">
              <input
                id="booking-reschedule-input"
                type="datetime-local"
                value={rescheduleAt}
                disabled={busy}
                onChange={(event) => setRescheduleAt(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="booking-drawer-save"
                disabled={busy || !rescheduleChanged}
                onClick={() => void reschedule()}
              >
                Сохранить время
              </Button>
            </div>
          </div>

          {showAudit ? (
            <section className="booking-audit-panel">
              <h3>Журнал изменений</h3>
              {auditLoading ? <Loader /> : null}
              {!auditLoading && !audit.length ? <p className="muted">Изменений пока нет.</p> : null}
              <ul className="booking-audit-list">
                {audit.map((entry) => (
                  <li key={entry.id}>
                    <time className="tnum">{new Date(entry.createdAt).toLocaleString('ru-RU')}</time>
                    <span>{entry.actor?.fullName || entry.actor?.email || 'Система'}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="booking-drawer-actions">
          {phone ? (
            <a href={`tel:${phone}`} className="btn btn-primary booking-drawer-call">
              <span className="booking-drawer-call-icon" aria-hidden>
                <Phone size={16} />
              </span>
              Позвонить
            </a>
          ) : null}
          {visitActions.length ? (
            <div className="booking-drawer-visit">
              {visitActions.map((action) => (
                <Button
                  key={action.status}
                  type="button"
                  variant={action.variant}
                  disabled={busy}
                  onClick={() => void updateStatus(action.status)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
          {showConfirm ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateStatus('CONFIRMED')}>
              {booking.status === 'PENDING' ? 'Подтвердить после согласования' : 'Подтвердить'}
            </Button>
          ) : null}
          {showCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="booking-drawer-cancel"
              disabled={busy}
              onClick={() => void updateStatus('CANCELLED')}
            >
              Отменить
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
