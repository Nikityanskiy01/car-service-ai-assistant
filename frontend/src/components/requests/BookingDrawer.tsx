import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, X } from 'lucide-react';
import { getBookingAudit, patchBooking, type BookingAuditEntry } from '../../api/dashboard';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { StatusBadge } from '../ui/StatusBadge';
import type { ServiceBooking } from '../../types/dashboard';

type Props = {
  booking: ServiceBooking | null;
  onClose: () => void;
  onUpdated?: (booking: ServiceBooking) => void;
  showAudit?: boolean;
  requestBasePath?: string;
};

export function BookingDrawer({
  booking,
  onClose,
  onUpdated,
  showAudit = false,
  requestBasePath = '/dashboard/manager/requests',
}: Props) {
  const [audit, setAudit] = useState<BookingAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState('');

  useEffect(() => {
    if (!booking) return;
    const local = new Date(booking.preferredAt);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setRescheduleAt(local.toISOString().slice(0, 16));
  }, [booking?.id, booking?.preferredAt]);

  useEffect(() => {
    if (!booking || !showAudit) {
      setAudit([]);
      return;
    }
    setAuditLoading(true);
    void getBookingAudit(booking.id)
      .then(setAudit)
      .catch(() => setAudit([]))
      .finally(() => setAuditLoading(false));
  }, [booking?.id, showAudit]);

  if (!booking) return null;

  const name = booking.client?.fullName || booking.guestName || 'Клиент';
  const phone = booking.client?.phone || booking.guestPhone || '';
  const sr = booking.serviceRequest;
  const car = sr ? [sr.snapshotMake, sr.snapshotModel].filter(Boolean).join(' ') : '';

  async function updateStatus(status: 'CONFIRMED' | 'ARRIVED' | 'NO_SHOW' | 'CANCELLED') {
    setBusy(true);
    try {
      const updated = await patchBooking(booking!.id, { status });
      onUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!rescheduleAt) return;
    setBusy(true);
    try {
      const updated = await patchBooking(booking!.id, {
        preferredAt: new Date(rescheduleAt).toISOString(),
      });
      onUpdated?.(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="booking-drawer"
        role="dialog"
        aria-label="Карточка записи"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="booking-drawer-header">
          <h2>Запись</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <dl className="detail-dl">
          <div>
            <dt>Дата и время</dt>
            <dd>{new Date(booking.preferredAt).toLocaleString('ru-RU')}</dd>
          </div>
          <div>
            <dt>Клиент</dt>
            <dd>{name}</dd>
          </div>
          {phone ? (
            <div>
              <dt>Телефон</dt>
              <dd>
                <a href={`tel:${phone}`}>{phone}</a>
              </dd>
            </div>
          ) : null}
          {car ? (
            <div>
              <dt>Автомобиль</dt>
              <dd>{car}</dd>
            </div>
          ) : null}
          <div>
            <dt>Статус</dt>
            <dd>
              <StatusBadge status={booking.status} />
            </dd>
          </div>
          {booking.notes ? (
            <div>
              <dt>Комментарий</dt>
              <dd>{booking.notes}</dd>
            </div>
          ) : null}
          {sr?.snapshotSymptoms ? (
            <div>
              <dt>Диагноз / симптомы</dt>
              <dd>{sr.snapshotSymptoms}</dd>
            </div>
          ) : null}
          {sr ? (
            <div>
              <dt>Заявка</dt>
              <dd>
                <Link to={`${requestBasePath}/${sr.id}`}>Открыть заявку</Link>
              </dd>
            </div>
          ) : null}
        </dl>

        <label className="stack gap-xs booking-reschedule">
          <span>Перенести на</span>
          <input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void reschedule()}>
            Сохранить время
          </Button>
        </label>

        {showAudit ? (
          <section className="booking-audit-panel">
            <h3>Журнал изменений</h3>
            {auditLoading ? <Loader /> : null}
            {!auditLoading && !audit.length ? <p className="muted">Изменений пока нет.</p> : null}
            <ul className="booking-audit-list">
              {audit.map((entry) => (
                <li key={entry.id}>
                  <time>{new Date(entry.createdAt).toLocaleString('ru-RU')}</time>
                  <span>{entry.actor?.fullName || entry.actor?.email || 'Система'}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="booking-drawer-actions">
          {phone ? (
            <a href={`tel:${phone}`} className="btn btn-secondary">
              <Phone size={16} aria-hidden />
              Позвонить
            </a>
          ) : null}
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void updateStatus('CONFIRMED')}>
            Подтвердить
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateStatus('ARRIVED')}>
            Приехал
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void updateStatus('NO_SHOW')}>
            No-show
          </Button>
          {sr ? (
            <Link to={`${requestBasePath}/${sr.id}`}>
              <Button>К заявке</Button>
            </Link>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
