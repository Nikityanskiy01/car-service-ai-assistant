import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { formatBookingRequestOption, formatBookingRequestSummary, getRequestVehicleLabel } from '../../lib/bookingDisplay';
import type { ServiceRequest } from '../../types/serviceRequest';
import { BookingRequestPreview } from './BookingChrome';
import { formatSummaryDate, type GuestFieldErrors, type QuickSlot } from './bookingWizard';

export function BookingStepWhen({
  quickSlots,
  preferredAt,
  onPreferredAt,
}: {
  quickSlots: QuickSlot[];
  preferredAt: string;
  onPreferredAt: (value: string) => void;
}) {
  return (
    <div className="booking-slot-section stack">
      <p className="booking-slot-hint-label">Нажмите на удобный слот</p>
      <div className="booking-slot-grid" role="group" aria-label="Быстрый выбор времени">
        {quickSlots.map((slot) => {
          const selected = preferredAt === slot.value;
          return (
            <button
              key={slot.id}
              type="button"
              className={`booking-slot-chip${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onPreferredAt(slot.value)}
            >
              <span className="booking-slot-check" aria-hidden="true" />
              <span className="booking-slot-day">{slot.dayLabel}</span>
              <strong>{slot.hint}</strong>
              <span className="booking-slot-hint">{slot.label}</span>
            </button>
          );
        })}
      </div>
      <FormField label="Другое время" htmlFor="bookingDate">
        <Input
          id="bookingDate"
          name="preferredAt"
          type="datetime-local"
          required
          value={preferredAt}
          onChange={(e) => onPreferredAt(e.target.value)}
          aria-label="Предпочтительное время"
        />
      </FormField>
    </div>
  );
}

export function BookingStepContacts({
  isClient,
  user,
  fullName,
  phone,
  email,
  guestFieldErrors,
  onFullName,
  onPhone,
  onEmail,
  clearGuestError,
}: {
  isClient: boolean;
  user?: { fullName?: string; phone?: string; email?: string } | null;
  fullName: string;
  phone: string;
  email: string;
  guestFieldErrors: GuestFieldErrors;
  onFullName: (value: string) => void;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
  clearGuestError: (field: keyof GuestFieldErrors) => void;
}) {
  if (isClient) {
    return (
      <div className="booking-profile-card">
        <span className="booking-profile-avatar" aria-hidden="true">
          {(user?.fullName || '?').slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="booking-profile-name">{user?.fullName}</p>
          {user?.phone ? <p className="muted-text">{user.phone}</p> : null}
          {user?.email ? <p className="muted-text">{user.email}</p> : null}
          <p className="booking-profile-hint">Данные из профиля — менять не нужно.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <FormField
        label="Имя"
        htmlFor="bookingName"
        hint="Как к вам обращаться при подтверждении записи"
        error={guestFieldErrors.fullName}
      >
        <Input
          name="fullName"
          autoComplete="name"
          required
          placeholder="Иван Иванов"
          value={fullName}
          onChange={(e) => {
            onFullName(e.target.value);
            if (guestFieldErrors.fullName) clearGuestError('fullName');
          }}
        />
      </FormField>
      <FormField
        label="Телефон"
        htmlFor="bookingPhone"
        hint="Для звонка или SMS с подтверждением"
        error={guestFieldErrors.phone}
      >
        <PhoneInput
          name="phone"
          required
          value={phone}
          onChange={(value) => {
            onPhone(value);
            if (guestFieldErrors.phone) clearGuestError('phone');
          }}
        />
      </FormField>
      <FormField
        label="Email (необязательно)"
        htmlFor="bookingEmail"
        hint="Отправим подтверждение, если укажете"
        error={guestFieldErrors.email}
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="client@example.com"
          value={email}
          onChange={(e) => {
            onEmail(e.target.value);
            if (guestFieldErrors.email) clearGuestError('email');
          }}
        />
      </FormField>
    </>
  );
}

export function BookingStepDetails({
  notes,
  onNotes,
  isClient,
  requests,
  serviceRequestId,
  onServiceRequestId,
  selectedRequest,
  vehicleTitle,
}: {
  notes: string;
  onNotes: (value: string) => void;
  isClient: boolean;
  requests: ServiceRequest[];
  serviceRequestId: string;
  onServiceRequestId: (value: string) => void;
  selectedRequest?: ServiceRequest;
  vehicleTitle: string;
}) {
  return (
    <>
      <FormField label="Комментарий" htmlFor="bookingNotes" hint="Необязательно — симптомы, пожелания по времени">
        <Textarea
          id="bookingNotes"
          name="notes"
          rows={4}
          placeholder="Например: стук при торможении, удобнее утром"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
        />
      </FormField>
      {isClient && requests.length > 0 ? (
        <div className="booking-request-field">
          <FormField
            label="Привязать к обращению"
            htmlFor="bookingRequest"
            hint="Заявка из кабинета, не автомобиль. Можно не выбирать."
          >
            <select
              id="bookingRequest"
              className="input"
              value={serviceRequestId}
              onChange={(e) => onServiceRequestId(e.target.value)}
              aria-controls={selectedRequest ? 'booking-request-preview' : undefined}
            >
              <option value="">Не привязывать к заявке</option>
              {requests.map((req) => (
                <option key={req.id} value={req.id}>
                  {formatBookingRequestOption(req)}
                </option>
              ))}
            </select>
          </FormField>
          {selectedRequest ? (
            <BookingRequestPreview request={selectedRequest} bookingVehicleTitle={vehicleTitle} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function BookingStepReview({
  preferredAt,
  selectedVehicle,
  vehicleTitle,
  isClient,
  fullName,
  phone,
  notes,
  selectedRequest,
  consent,
  consentError,
  onConsent,
}: {
  preferredAt: string;
  selectedVehicle: unknown;
  vehicleTitle: string;
  isClient: boolean;
  fullName: string;
  phone: string;
  notes: string;
  selectedRequest?: ServiceRequest;
  consent: boolean;
  consentError: string | null;
  onConsent: (value: boolean) => void;
}) {
  return (
    <div className="booking-review stack">
      <dl className="booking-wizard-review">
        <div>
          <dt>Время записи</dt>
          <dd>{formatSummaryDate(preferredAt)}</dd>
        </div>
        {selectedVehicle ? (
          <div>
            <dt>Автомобиль</dt>
            <dd>{vehicleTitle}</dd>
          </div>
        ) : null}
        {!isClient ? (
          <>
            <div>
              <dt>Имя</dt>
              <dd>{fullName}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>{phone}</dd>
            </div>
          </>
        ) : null}
        {notes ? (
          <div>
            <dt>Комментарий</dt>
            <dd>{notes}</dd>
          </div>
        ) : null}
        {selectedRequest ? (
          <div>
            <dt>Обращение</dt>
            <dd>
              {formatBookingRequestSummary(selectedRequest)}
              {getRequestVehicleLabel(selectedRequest)
                ? ` · ${getRequestVehicleLabel(selectedRequest)}`
                : ''}
            </dd>
          </div>
        ) : null}
      </dl>
      <ConsentCheckbox
        id="bookingConsent"
        checked={consent}
        onChange={(v) => onConsent(v)}
        error={consentError}
      />
    </div>
  );
}
