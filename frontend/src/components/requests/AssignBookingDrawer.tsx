import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { createStaffBooking } from '../../api/dashboard';
import { formatBookingDateParts } from '../../lib/bookingDisplay';
import { Button } from '../ui/Button';
import { useToast } from '../ui/toastContext';
import type { ServiceRequestDetail } from '../../types/serviceRequest';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDatetimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultSlot() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

type Props = {
  open: boolean;
  request: ServiceRequestDetail | null;
  onClose: () => void;
  onCreated: () => void;
};

export function AssignBookingDrawer({ open, request, onClose, onCreated }: Props) {
  const { success, error: toastError } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [preferredAt, setPreferredAt] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minValue = useMemo(() => toDatetimeLocalValue(new Date()), [open]);

  useEffect(() => {
    if (!open) return;
    setPreferredAt(toDatetimeLocalValue(defaultSlot()));
    setNotes('');
    setError(null);
    setBusy(false);
  }, [open, request?.id]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !request) return null;

  const name = request.client?.fullName || request.guestName || 'Клиент';
  const preview = preferredAt ? formatBookingDateParts(new Date(preferredAt).toISOString()).short : '';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!request || !preferredAt) return;
    setBusy(true);
    setError(null);
    try {
      await createStaffBooking({
        preferredAt: new Date(preferredAt).toISOString(),
        serviceRequestId: request.id,
        notes: notes.trim() || null,
      });
      success('Запись назначена. Клиент её видит — подтвердите после согласования.');
      onCreated();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось назначить запись';
      setError(message);
      toastError(message);
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
        data-status-tone="waiting"
        aria-labelledby="assign-booking-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="booking-drawer-header">
          <div className="booking-drawer-heading">
            <p className="booking-drawer-kicker">Внутренняя запись</p>
            <h2 id="assign-booking-title">{name}</h2>
            <p className="booking-drawer-when">Клиент увидит слот в кабинете</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-ghost btn-icon booking-drawer-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <form className="booking-drawer-assign-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="booking-drawer-body">
            <section className="booking-drawer-notes is-warn" role="status">
              <h3>Сначала согласуйте</h3>
              <p>
                Клиент сразу увидит это время. Подтвердите запись только после договорённости — до
                этого она не окончательная.
              </p>
            </section>

            <div className="booking-reschedule">
              <label htmlFor="assign-booking-at">
                <CalendarClock size={14} aria-hidden />
                Дата и время
              </label>
              <input
                id="assign-booking-at"
                type="datetime-local"
                required
                min={minValue}
                value={preferredAt}
                disabled={busy}
                onChange={(event) => {
                  setPreferredAt(event.target.value);
                  if (error) setError(null);
                }}
              />
              {preview ? (
                <p className="booking-drawer-when">
                  Слот: <span className="tnum">{preview}</span>
                  <span className="booking-drawer-relative">9:00–21:00 МСК</span>
                </p>
              ) : null}
            </div>

            <label className="booking-reschedule" htmlFor="assign-booking-notes">
              Комментарий для клиента
              <textarea
                id="assign-booking-notes"
                className="textarea"
                rows={3}
                maxLength={2000}
                value={notes}
                disabled={busy}
                placeholder="Необязательно — что согласовали или что взять с собой"
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>

            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="booking-drawer-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={busy || !preferredAt}>
              {busy ? 'Назначаем…' : 'Назначить слот'}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
