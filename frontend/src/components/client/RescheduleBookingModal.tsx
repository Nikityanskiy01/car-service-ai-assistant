import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock } from 'lucide-react';
import { rescheduleBooking } from '../../api/dashboard';
import { formatBookingDateParts } from '../../lib/bookingDisplay';
import { Button } from '../ui/Button';
import { FormField } from '../forms/FormField';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import type { ServiceBooking } from '../../types/dashboard';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDatetimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatPickedDate(value: string) {
  if (!value) return '';
  return formatBookingDateParts(new Date(value).toISOString()).short;
}

export function RescheduleBookingModal({
  open,
  booking,
  onClose,
  onUpdated,
}: {
  open: boolean;
  booking: ServiceBooking | null;
  onClose: () => void;
  onUpdated: (booking: ServiceBooking) => void;
}) {
  const [preferredAt, setPreferredAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLabel = booking ? formatBookingDateParts(booking.preferredAt).short : '';
  const minValue = useMemo(() => toDatetimeLocalValue(new Date()), [open]);
  const needsReconfirm = booking?.status === 'CONFIRMED';

  useEffect(() => {
    if (!open || !booking) return;
    const current = new Date(booking.preferredAt);
    const now = new Date();
    now.setSeconds(0, 0);
    const start = current.getTime() > now.getTime() ? current : now;
    setPreferredAt(toDatetimeLocalValue(start));
    setError(null);
    setSaving(false);
  }, [open, booking]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!booking || !preferredAt) return;
    const nextIso = new Date(preferredAt).toISOString();
    if (nextIso === new Date(booking.preferredAt).toISOString()) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await rescheduleBooking(booking.id, nextIso);
      onUpdated(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось перенести запись');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Перенести запись" onClose={onClose} className="modal-reschedule-booking">
      <form className="reschedule-booking-form" onSubmit={(e) => void handleSubmit(e)}>
        <p className="reschedule-booking-lead">
          Меняется только дата и время. Услуга, авто и комментарий остаются как есть.
        </p>

        <div className="reschedule-booking-now" aria-live="polite">
          <span className="reschedule-booking-now-icon" aria-hidden>
            <CalendarClock size={18} />
          </span>
          <div>
            <span>Сейчас</span>
            <strong>{currentLabel}</strong>
          </div>
        </div>

        <FormField
          label="Новая дата и время"
          htmlFor="reschedule-at"
          hint="С 9:00 до 21:00 по Москве"
          error={error}
        >
          <Input
            id="reschedule-at"
            type="datetime-local"
            required
            min={minValue}
            value={preferredAt}
            onChange={(e) => {
              setPreferredAt(e.target.value);
              if (error) setError(null);
            }}
            autoFocus
          />
        </FormField>

        {preferredAt ? (
          <p className="reschedule-booking-preview">
            Новое время: <strong>{formatPickedDate(preferredAt)}</strong>
          </p>
        ) : null}

        {needsReconfirm ? (
          <p className="reschedule-booking-note">После переноса менеджер подтвердит слот заново.</p>
        ) : (
          <p className="reschedule-booking-note">Менеджер подтвердит выбранный слот.</p>
        )}

        <div className="reschedule-booking-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !preferredAt}>
            {saving ? 'Сохранение…' : 'Перенести'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
