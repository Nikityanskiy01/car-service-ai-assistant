import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  CircleCheck,
  ClipboardList,
  Phone,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { listServiceRequests } from '../../api/dashboard';
import { useAuth } from '../../auth/AuthProvider';
import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { usePageMeta } from '../../hooks/usePageMeta';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { getEmailError, getFullNameError, getPhoneError } from '../../lib/validation';
import type { ServiceRequest } from '../../types/serviceRequest';

type GuestFieldErrors = {
  fullName?: string;
  phone?: string;
  email?: string;
};

type BookingPrefill = {
  serviceTitle?: string;
  categoryLabel?: string;
  consultationSummary?: string;
  fromConsultation?: boolean;
  serviceRequestId?: string;
  fullName?: string;
  phone?: string;
};

type CreatedBooking = { id: string };

const STEPS = [
  {
    id: 1,
    label: 'Когда',
    title: 'Когда вам удобно?',
    description: 'Выберите слот — перезвоним для подтверждения.',
    icon: CalendarDays,
  },
  {
    id: 2,
    label: 'Контакты',
    title: 'Как с вами связаться?',
    description: 'Нужны только для уточнения деталей визита.',
    icon: UserRound,
  },
  {
    id: 3,
    label: 'Детали',
    title: 'Что привезти на сервис?',
    description: 'Опишите проблему — мастер подготовится заранее.',
    icon: ClipboardList,
  },
  {
    id: 4,
    label: 'Готово',
    title: 'Всё верно?',
    description: 'Проверьте данные и отправьте заявку.',
    icon: CircleCheck,
  },
] as const;

type QuickSlot = { id: string; label: string; dayLabel: string; hint: string; value: string };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDatetimeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildQuickSlots(): QuickSlot[] {
  const make = (daysFromNow: number, hour: number, minute: number, label: string, hint: string): QuickSlot => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hour, minute, 0, 0);
    const dayLabel = date.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return { id: `${daysFromNow}-${hour}-${minute}`, label, dayLabel, hint, value: toDatetimeLocalValue(date) };
  };

  return [
    make(1, 10, 0, 'Завтра утром', '10:00'),
    make(1, 14, 0, 'Завтра днём', '14:00'),
    make(2, 11, 0, 'Послезавтра', '11:00'),
    make(3, 16, 0, 'Через 3 дня', '16:00'),
  ];
}

function formatSummaryDate(value: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompactDate(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function BookingProgress({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick: (target: number) => void;
}) {
  return (
    <ol className="booking-track" aria-label="Прогресс записи">
      {STEPS.map((item) => {
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

function BookingLiveSummary({
  step,
  preferredAt,
  fullName,
  phone,
  notes,
  isClient,
  userName,
}: {
  step: number;
  preferredAt: string;
  fullName: string;
  phone: string;
  notes: string;
  isClient: boolean;
  userName?: string;
}) {
  const contactName = isClient ? userName : fullName;
  const hasAny = preferredAt || contactName || phone || notes;
  if (!hasAny || step === 4) return null;

  return (
    <div className="booking-live-summary" aria-live="polite">
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
      {notes ? (
        <span className="booking-live-chip booking-live-chip-muted">
          <ClipboardList size={14} aria-hidden="true" />
          Комментарий добавлен
        </span>
      ) : null}
    </div>
  );
}

export function BookingPage() {
  const productConfig = useProductConfig();
  usePageMeta({ title: 'Записаться в сервис', description: 'Онлайн-запись на ремонт и ТО.' });
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isClient = isAuthenticated && user?.role === 'CLIENT';
  const quickSlots = useMemo(() => buildQuickSlots(), []);

  const prefill = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.bookingPrefill);
      return raw ? (JSON.parse(raw) as BookingPrefill) : {};
    } catch {
      return {};
    }
  }, []);

  const [step, setStep] = useState(1);
  const [notes, setNotes] = useState(
    prefill.consultationSummary || (prefill.serviceTitle ? `Интересует услуга: ${prefill.serviceTitle}` : ''),
  );
  const [fullName, setFullName] = useState(prefill.fullName || '');
  const [phone, setPhone] = useState(prefill.phone || '');
  const [email, setEmail] = useState('');
  const [preferredAt, setPreferredAt] = useState('');
  const [serviceRequestId, setServiceRequestId] = useState(prefill.serviceRequestId || '');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [guestFieldErrors, setGuestFieldErrors] = useState<GuestFieldErrors>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isClient || !user) return;
    if (!fullName && user.fullName) setFullName(user.fullName);
    if (!phone && user.phone) setPhone(user.phone);
    if (!email && user.email) setEmail(user.email);
  }, [email, fullName, isClient, phone, user]);

  useEffect(() => {
    if (!isClient) return;
    void (async () => {
      try {
        const data = await listServiceRequests({ pageSize: 50, sort: 'createdAt', dir: 'desc' });
        const active = data.items.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
        setRequests(active);
      } catch {
        setRequests([]);
      }
    })();
  }, [isClient]);

  const selectedRequest = requests.find((r) => r.id === serviceRequestId);
  const currentStep = STEPS[step - 1];

  function validateStep(current: number): boolean {
    setStepError(null);
    if (current === 1 && !preferredAt) {
      setStepError('Выберите удобное время или укажите дату вручную');
      return false;
    }
    if (current === 2 && !isClient) {
      const nextErrors: GuestFieldErrors = {};
      const nameError = getFullNameError(fullName);
      if (nameError) nextErrors.fullName = nameError;
      const phoneError = getPhoneError(phone);
      if (phoneError) nextErrors.phone = phoneError;
      const emailError = getEmailError(email, { required: false });
      if (emailError) nextErrors.email = emailError;
      setGuestFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setStepError('Проверьте контактные данные');
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function goToStep(target: number) {
    if (target >= step) return;
    setStepError(null);
    setStep(target);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isClient) {
      const nextErrors: GuestFieldErrors = {};
      const nameError = getFullNameError(fullName);
      if (nameError) nextErrors.fullName = nameError;
      const phoneError = getPhoneError(phone);
      if (phoneError) nextErrors.phone = phoneError;
      const emailError = getEmailError(email, { required: false });
      if (emailError) nextErrors.email = emailError;
      setGuestFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
    }

    if (!consent) {
      setConsentError('Отметьте согласие на обработку персональных данных');
      return;
    }
    setConsentError(null);
    setLoading(true);
    setStatus(null);
    setStatusError(false);
    try {
      if (isClient) {
        const booking = await api<CreatedBooking>('/bookings', {
          method: 'POST',
          body: {
            preferredAt,
            notes: notes || null,
            serviceRequestId: serviceRequestId || null,
          },
        });
        navigate(`/dashboard/client/bookings/${booking.id}`, { replace: true });
        return;
      }

      await api('/bookings/guest', {
        method: 'POST',
        body: {
          preferredAt,
          fullName,
          phone,
          email: email || null,
          notes: notes || null,
          serviceTitle: prefill.serviceTitle || null,
          categoryLabel: prefill.categoryLabel || null,
          consentPersonalData: true,
        },
        skipAuthRefresh: true,
      });
      setStatus('Запись отправлена. Мы свяжемся для подтверждения.');
      setConsent(false);
      setStep(1);
    } catch (error) {
      setStatusError(true);
      setStatus(error instanceof Error ? error.message : 'Не удалось создать запись.');
    } finally {
      setLoading(false);
    }
  }

  let stepContent: ReactNode = null;

  if (step === 1) {
    stepContent = (
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
                onClick={() => setPreferredAt(slot.value)}
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
            onChange={(e) => setPreferredAt(e.target.value)}
            aria-label="Предпочтительное время"
          />
        </FormField>
      </div>
    );
  } else if (step === 2) {
    stepContent = !isClient ? (
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
              setFullName(e.target.value);
              if (guestFieldErrors.fullName) setGuestFieldErrors((prev) => ({ ...prev, fullName: undefined }));
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
              setPhone(value);
              if (guestFieldErrors.phone) setGuestFieldErrors((prev) => ({ ...prev, phone: undefined }));
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
              setEmail(e.target.value);
              if (guestFieldErrors.email) setGuestFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
          />
        </FormField>
      </>
    ) : (
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
  } else if (step === 3) {
    stepContent = (
      <>
        <FormField label="Комментарий" htmlFor="bookingNotes" hint="Необязательно — симптомы, пожелания по времени">
          <Textarea
            id="bookingNotes"
            name="notes"
            rows={4}
            placeholder="Например: стук при торможении, удобнее утром"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>
        {isClient ? (
          <FormField label="Привязать к обращению (необязательно)" htmlFor="bookingRequest">
            <select
              id="bookingRequest"
              className="input"
              value={serviceRequestId}
              onChange={(e) => setServiceRequestId(e.target.value)}
            >
              <option value="">Без привязки</option>
              {requests.map((req) => {
                const car = [req.snapshotMake, req.snapshotModel].filter(Boolean).join(' ');
                const label = car || `Заявка ${req.id.slice(0, 8)}`;
                return (
                  <option key={req.id} value={req.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </FormField>
        ) : null}
      </>
    );
  } else {
    stepContent = (
      <div className="booking-review stack">
        <dl className="booking-wizard-review">
          <div>
            <dt>Время визита</dt>
            <dd>{formatSummaryDate(preferredAt)}</dd>
          </div>
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
                {[selectedRequest.snapshotMake, selectedRequest.snapshotModel].filter(Boolean).join(' ') || 'Заявка'}
              </dd>
            </div>
          ) : null}
        </dl>
        <ConsentCheckbox
          id="bookingConsent"
          checked={consent}
          onChange={(v) => {
            setConsent(v);
            if (v) setConsentError(null);
          }}
          error={consentError}
        />
      </div>
    );
  }

  const subtitle = prefill.fromConsultation
    ? 'Осталось выбрать время — данные диагностики уже подставлены.'
    : 'Три шага — и мы подготовим приём вашего автомобиля.';

  return (
    <div className="fm-page booking-page">
      <div className="booking-shell">
        <header className="booking-header">
          <p className="fm-pill">
            <CalendarPlus size={14} aria-hidden="true" />
            Онлайн-запись
          </p>
          <h1>Записаться в сервис</h1>
          <p>{subtitle}</p>
          {isClient ? <p className="muted-text booking-header-note">Сохранится в личном кабинете.</p> : null}
        </header>

        <BookingProgress step={step} onStepClick={goToStep} />

        {prefill.fromConsultation ? (
          <div className="booking-banner" role="status">
            <Sparkles size={16} aria-hidden="true" />
            Данные из ИИ-диагностики в комментарии — проверьте на шаге «Детали».
          </div>
        ) : null}

        <section className="booking-card fm-card fm-card-static" aria-labelledby="booking-step-title">
          <div className="booking-step-content" key={step}>
            <header className="booking-step-intro">
              <p className="booking-step-eyebrow">
                Шаг {step} из {STEPS.length}
              </p>
              <h2 id="booking-step-title">{currentStep.title}</h2>
              <p className="booking-step-lead">{currentStep.description}</p>
            </header>

            <form className="fm-form booking-form stack" onSubmit={onSubmit} noValidate>
              {stepContent}

              {stepError ? <p className="form-error">{stepError}</p> : null}

              <BookingLiveSummary
                step={step}
                preferredAt={preferredAt}
                fullName={fullName}
                phone={phone}
                notes={notes}
                isClient={isClient}
                userName={user?.fullName}
              />

              <div className="booking-form-footer">
                {step > 1 ? (
                  <Button type="button" variant="ghost" className="booking-back-btn" onClick={goBack}>
                    <ChevronLeft size={18} aria-hidden="true" />
                    Назад
                  </Button>
                ) : null}
                {step < 4 ? (
                  <Button type="button" className="booking-next-btn" onClick={goNext}>
                    Далее
                  </Button>
                ) : (
                  <Button type="submit" className="booking-next-btn" disabled={loading}>
                    {loading ? 'Отправка...' : 'Отправить заявку'}
                  </Button>
                )}
              </div>

              {status ? (
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <p className={statusError ? 'form-status is-error' : 'form-status is-success'} role="status">
                    {status}
                  </p>
                  {!statusError && !isClient ? (
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
          {!prefill.fromConsultation ? (
            <Link className="booking-footer-promo" to="/consult">
              <Sparkles size={16} aria-hidden="true" />
              <span>
                <strong>Не знаете причину поломки?</strong>
                <small>Бесплатная ИИ-диагностика перед визитом</small>
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
