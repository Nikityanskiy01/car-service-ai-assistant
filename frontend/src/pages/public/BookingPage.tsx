import { CalendarPlus, ChevronLeft, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FormField } from '../../components/forms/FormField';
import { Button } from '../../components/ui/Button';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { BookingLiveSummary, BookingProgress } from '../../features/booking/BookingChrome';
import {
  BookingStepContacts,
  BookingStepDetails,
  BookingStepReview,
  BookingStepWhen,
} from '../../features/booking/BookingSteps';
import { BOOKING_STEPS } from '../../features/booking/bookingWizard';
import { useBookingPage } from '../../features/booking/useBookingPage';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatBookingRequestSummary } from '../../lib/bookingDisplay';
import { formatVehicleTitle } from '../../api/vehicles';

export function BookingPage() {
  const productConfig = useProductConfig();
  usePageMeta({ title: 'Записаться в сервис', description: 'Онлайн-запись на ремонт и ТО.' });
  const page = useBookingPage();

  let stepContent = null;
  if (page.step === 1) {
    stepContent = (
      <BookingStepWhen
        quickSlots={page.quickSlots}
        preferredAt={page.preferredAt}
        onPreferredAt={page.setPreferredAt}
      />
    );
  } else if (page.step === 2) {
    stepContent = (
      <BookingStepContacts
        isClient={Boolean(page.isClient)}
        user={page.user}
        fullName={page.fullName}
        phone={page.phone}
        email={page.email}
        guestFieldErrors={page.guestFieldErrors}
        onFullName={page.setFullName}
        onPhone={page.setPhone}
        onEmail={page.setEmail}
        clearGuestError={(field) =>
          page.setGuestFieldErrors((prev) => ({ ...prev, [field]: undefined }))
        }
      />
    );
  } else if (page.step === 3) {
    stepContent = (
      <BookingStepDetails
        notes={page.notes}
        onNotes={page.setNotes}
        isClient={Boolean(page.isClient)}
        requests={page.requests}
        serviceRequestId={page.serviceRequestId}
        onServiceRequestId={page.setServiceRequestId}
        selectedRequest={page.selectedRequest}
        vehicleTitle={page.vehicleTitle}
      />
    );
  } else {
    stepContent = (
      <BookingStepReview
        preferredAt={page.preferredAt}
        selectedVehicle={page.selectedVehicle}
        vehicleTitle={page.vehicleTitle}
        isClient={Boolean(page.isClient)}
        fullName={page.fullName}
        phone={page.phone}
        notes={page.notes}
        selectedRequest={page.selectedRequest}
        consent={page.consent}
        consentError={page.consentError}
        onConsent={(v) => {
          page.setConsent(v);
          if (v) page.setConsentError(null);
        }}
      />
    );
  }

  return (
    <div className="fm-page booking-page">
      <div className="booking-shell">
        <header className="booking-header">
          <p className="fm-pill">
            <CalendarPlus size={14} aria-hidden="true" />
            Онлайн-запись
          </p>
          <h1>Записаться в сервис</h1>
          <p>{page.subtitle}</p>
          {page.isClient ? <p className="muted-text booking-header-note">Сохранится в личном кабинете.</p> : null}
        </header>

        <BookingProgress step={page.step} onStepClick={page.goToStep} />

        {page.prefill.fromConsultation ? (
          <div className="booking-banner" role="status">
            <Sparkles size={16} aria-hidden="true" />
            Данные из ИИ-диагностики в комментарии — проверьте на шаге «Детали».
          </div>
        ) : null}

        {page.isClient && page.vehicleLocked && page.selectedVehicle ? (
          <div className="booking-profile-card booking-vehicle-card" role="status">
            <span className="booking-profile-avatar" aria-hidden="true">
              {page.vehicleInitials || 'А'}
            </span>
            <div>
              <p className="booking-profile-name">{page.vehicleTitle}</p>
              {page.vehicleMeta ? <p className="muted-text">{page.vehicleMeta}</p> : null}
              <p className="booking-profile-hint">Запись будет привязана к этому автомобилю из гаража.</p>
            </div>
          </div>
        ) : null}

        <section className="booking-card fm-card fm-card-static" aria-labelledby="booking-step-title">
          <div className="booking-step-content" key={page.step}>
            <header className="booking-step-intro">
              <p className="booking-step-eyebrow">
                Шаг {page.step} из {BOOKING_STEPS.length}
              </p>
              <h2 id="booking-step-title">{page.currentStep.title}</h2>
              <p className="booking-step-lead">{page.currentStep.description}</p>
            </header>

            <form className="fm-form booking-form stack" onSubmit={page.onSubmit} noValidate>
              {page.isClient && !page.vehicleLocked && page.vehicles.length > 0 ? (
                <FormField
                  label="Автомобиль"
                  htmlFor="bookingVehicle"
                  hint="Можно не выбирать, если записываетесь не из гаража"
                >
                  <select
                    id="bookingVehicle"
                    className="input"
                    value={page.vehicleId}
                    onChange={(e) => page.setVehicleId(e.target.value)}
                  >
                    <option value="">Не выбран</option>
                    {page.vehicles.map((row) => (
                      <option key={row.id} value={row.id}>
                        {formatVehicleTitle(row)}
                        {row.licensePlate ? ` · ${row.licensePlate}` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}
              {stepContent}

              {page.stepError ? <p className="form-error">{page.stepError}</p> : null}

              <BookingLiveSummary
                step={page.step}
                preferredAt={page.preferredAt}
                fullName={page.fullName}
                phone={page.phone}
                notes={page.notes}
                isClient={Boolean(page.isClient)}
                userName={page.user?.fullName}
                vehicleTitle={page.vehicleTitle || undefined}
                requestSummary={
                  page.selectedRequest ? formatBookingRequestSummary(page.selectedRequest) : undefined
                }
              />

              <div className="booking-form-footer">
                {page.step > 1 ? (
                  <Button type="button" variant="ghost" className="booking-back-btn" onClick={page.goBack}>
                    <ChevronLeft size={18} aria-hidden="true" />
                    Назад
                  </Button>
                ) : null}
                {page.step < 4 ? (
                  <Button type="button" className="booking-next-btn" onClick={page.goNext}>
                    Далее
                  </Button>
                ) : (
                  <Button type="submit" className="booking-next-btn" disabled={page.loading}>
                    {page.loading ? 'Отправка...' : 'Отправить заявку'}
                  </Button>
                )}
              </div>

              {page.status ? (
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <p className={page.statusError ? 'form-status is-error' : 'form-status is-success'} role="status">
                    {page.status}
                  </p>
                  {!page.statusError && !page.isClient ? (
                    <p className="muted-text">
                      Хотите отслеживать статус?{' '}
                      <Link to="/register">Создайте аккаунт</Link> или <Link to="/login">войдите</Link>.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          </div>
        </section>

        <footer className="booking-footer">
          {!page.prefill.fromConsultation ? (
            <Link className="booking-footer-promo" to="/consult">
              <Sparkles size={16} aria-hidden="true" />
              <span>
                <strong>Не знаете причину поломки?</strong>
                <small>Бесплатная ИИ-диагностика перед записью</small>
              </span>
            </Link>
          ) : null}
          {productConfig.phone ? (
            <p className="booking-footer-help">
              <Phone size={14} aria-hidden="true" />
              <a href={`tel:${productConfig.phone.replace(/\D/g, '')}`}>{productConfig.phone}</a>
              <span className="booking-footer-hours">{productConfig.workingHours}</span>
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
