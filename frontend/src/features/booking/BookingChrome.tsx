import { CalendarDays, Car, ClipboardList, UserRound } from 'lucide-react';
import {
  formatBookingRequestSummary,
  getRequestVehicleLabel,
  requestCarDiffersFromBooking,
} from '../../lib/bookingDisplay';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import type { ServiceRequest } from '../../types/serviceRequest';
import { BOOKING_STEPS, formatCompactDate } from './bookingWizard';

export function BookingProgress({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick: (target: number) => void;
}) {
  return (
    <ol className="booking-track" aria-label="Прогресс записи">
      {BOOKING_STEPS.map((item) => {
        const done = step > item.id;
        const active = step === item.id;
        const state = active ? 'is-active' : done ? 'is-done' : '';
        return (
          <li key={item.id} className={`booking-track-step ${state}`}>
            <button
              type="button"
              className="booking-track-btn"
              disabled={!done}
              aria-current={active ? 'step' : undefined}
              onClick={() => done && onStepClick(item.id)}
            >
              <span className="booking-track-dot" aria-hidden="true">
                {done ? '✓' : item.id}
              </span>
              <span className="booking-track-label">{item.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function BookingLiveSummary({
  step,
  preferredAt,
  fullName,
  phone,
  notes,
  isClient,
  userName,
  vehicleTitle,
  requestSummary,
}: {
  step: number;
  preferredAt: string;
  fullName: string;
  phone: string;
  notes: string;
  isClient: boolean;
  userName?: string;
  vehicleTitle?: string;
  requestSummary?: string;
}) {
  const contactName = isClient ? userName : fullName;
  const hasAny = preferredAt || contactName || phone || notes || vehicleTitle || requestSummary;
  if (!hasAny || step === 4) return null;

  return (
    <div className="booking-live-summary" aria-live="polite">
      {vehicleTitle ? (
        <span className="booking-live-chip">
          <Car size={14} aria-hidden="true" />
          {vehicleTitle}
        </span>
      ) : null}
      {preferredAt ? (
        <span className="booking-live-chip">
          <CalendarDays size={14} aria-hidden="true" />
          {formatCompactDate(preferredAt)}
        </span>
      ) : null}
      {contactName || phone ? (
        <span className="booking-live-chip">
          <UserRound size={14} aria-hidden="true" />
          {contactName || phone}
        </span>
      ) : null}
      {requestSummary ? (
        <span className="booking-live-chip">
          <ClipboardList size={14} aria-hidden="true" />
          {requestSummary}
        </span>
      ) : null}
      {notes ? (
        <span className="booking-live-chip booking-live-chip-muted">
          <ClipboardList size={14} aria-hidden="true" />
          Комментарий добавлен
        </span>
      ) : null}
    </div>
  );
}

export function BookingRequestPreview({
  request,
  bookingVehicleTitle,
}: {
  request: ServiceRequest;
  bookingVehicleTitle?: string;
}) {
  const number = formatRequestNumber(request.id);
  const topic = request.snapshotSymptoms?.trim() || 'Тема не указана';
  const car = getRequestVehicleLabel(request);
  const status = SERVICE_REQUEST_STATUS_LABELS[request.status] || request.status;
  const created = request.createdAt
    ? new Date(request.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : '';
  const mismatch = requestCarDiffersFromBooking(request, bookingVehicleTitle);

  return (
    <div className="booking-request-preview" id="booking-request-preview">
      <div className="booking-request-preview-top">
        <strong>Обращение №{number}</strong>
        <span>{status}</span>
      </div>
      <p className="booking-request-preview-topic">{topic}</p>
      <p className="booking-request-preview-meta">
        {car ? <span>Авто в заявке: {car}</span> : <span>Авто в заявке не указано</span>}
        {created ? <span>от {created}</span> : null}
      </p>
      {mismatch ? (
        <p className="booking-request-preview-note">
          Запись на {bookingVehicleTitle} — это другое авто, чем в обращении.
        </p>
      ) : null}
    </div>
  );
}
