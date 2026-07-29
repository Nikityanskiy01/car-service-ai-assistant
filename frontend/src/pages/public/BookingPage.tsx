import { useEffect, useMemo, useState } from 'react';
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
import { usePageMeta } from '../../hooks/usePageMeta';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import type { ServiceRequest } from '../../types/serviceRequest';

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
  { id: 1, label: 'Когда' },
  { id: 2, label: 'Контакты' },
  { id: 3, label: 'Детали' },
  { id: 4, label: 'Подтверждение' },
] as const;

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

export function BookingPage() {
  usePageMeta({ title: 'Запись в сервис', description: 'Онлайн-запись на ремонт и ТО.' });
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isClient = isAuthenticated && user?.role === 'CLIENT';

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

  function validateStep(current: number): boolean {
    setStepError(null);
    if (current === 1 && !preferredAt) {
      setStepError('Укажите предпочтительное время визита');
      return false;
    }
    if (current === 2 && !isClient) {
      if (!fullName.trim()) {
        setStepError('Укажите имя');
        return false;
      }
      if (!phone.trim()) {
        setStepError('Укажите телефон');
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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

  return (
    <div className="fm-page">
      <header className="fm-page-head">
        <h1>Запись в сервис</h1>
        <p>
          {prefill.fromConsultation
            ? 'Заявка после ИИ-диагностики создана — укажите удобное время визита.'
            : 'Укажите удобное время. Не уверены в причине поломки? '}
          {!prefill.fromConsultation ? <Link to="/consult">Сначала пройдите ИИ-диагностику</Link> : null}
          {!prefill.fromConsultation ? '.' : null}
        </p>
        {isClient ? <p className="muted-text">Запись будет сохранена в вашем кабинете.</p> : null}
      </header>

      <ol className="booking-wizard-steps" aria-label="Шаги записи">
        {STEPS.map((item) => (
          <li key={item.id} className={step === item.id ? 'is-active' : step > item.id ? 'is-done' : ''}>
            <span className="booking-wizard-num">{item.id}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ol>

      <section className="fm-card fm-card-static fm-form-card">
        <form className="fm-form stack" onSubmit={onSubmit} noValidate>
          {step === 1 ? (
            <FormField label="Предпочтительное время" htmlFor="bookingDate">
              <Input
                id="bookingDate"
                name="preferredAt"
                type="datetime-local"
                required
                value={preferredAt}
                onChange={(e) => setPreferredAt(e.target.value)}
              />
            </FormField>
          ) : null}

          {step === 2 ? (
            !isClient ? (
              <>
                <FormField label="Имя" htmlFor="bookingName">
                  <Input
                    id="bookingName"
                    name="fullName"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </FormField>
                <FormField label="Телефон" htmlFor="bookingPhone">
                  <PhoneInput id="bookingPhone" name="phone" required value={phone} onChange={setPhone} />
                </FormField>
                <FormField label="Email (необязательно)" htmlFor="bookingEmail">
                  <Input
                    id="bookingEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
              </>
            ) : (
              <div className="booking-wizard-summary-block">
                <h3>Контактные данные</h3>
                <p>
                  <strong>{user?.fullName}</strong>
                </p>
                {user?.phone ? <p className="muted-text">{user.phone}</p> : null}
                {user?.email ? <p className="muted-text">{user.email}</p> : null}
              </div>
            )
          ) : null}

          {step === 3 ? (
            <>
              <FormField label="Комментарий" htmlFor="bookingNotes">
                <Textarea id="bookingNotes" name="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          ) : null}

          {step === 4 ? (
            <div className="booking-wizard-summary-block stack">
              <h3>Проверьте данные</h3>
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
                      {[selectedRequest.snapshotMake, selectedRequest.snapshotModel].filter(Boolean).join(' ') ||
                        'Заявка'}
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
          ) : null}

          {stepError ? <p className="form-error">{stepError}</p> : null}

          <div className="booking-wizard-nav">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={goBack}>
                Назад
              </Button>
            ) : (
              <span />
            )}
            {step < 4 ? (
              <Button type="button" onClick={goNext}>
                Далее
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
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
      </section>
    </div>
  );
}
