import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { listServiceRequests } from '../../api/dashboard';
import { formatVehicleTitle, listVehicles, type ClientVehicle } from '../../api/vehicles';
import { useAuth } from '../../auth/AuthProvider';
import { trackProductEvent } from '../../lib/productEvents';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { getEmailError, getFullNameError, getPhoneError } from '../../lib/validation';
import type { ServiceRequest } from '../../types/serviceRequest';
import {
  BOOKING_STEPS,
  buildQuickSlots,
  type BookingPrefill,
  type CreatedBooking,
  type GuestFieldErrors,
} from './bookingWizard';

export function useBookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const isClient = isAuthenticated && user?.role === 'CLIENT';
  const quickSlots = useMemo(() => buildQuickSlots(), []);
  const queryVehicleId = searchParams.get('vehicleId')?.trim() || '';

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
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState(queryVehicleId || prefill.vehicleId || '');
  const vehicleLocked = Boolean(queryVehicleId);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [guestFieldErrors, setGuestFieldErrors] = useState<GuestFieldErrors>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

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

  useEffect(() => {
    if (!isClient) return;
    void listVehicles()
      .then((rows) => {
        setVehicles(rows);
        setVehicleId((current) => {
          if (current) return current;
          return rows.length === 1 ? rows[0].id : '';
        });
      })
      .catch(() => setVehicles([]));
  }, [isClient]);

  const selectedRequest = requests.find((r) => r.id === serviceRequestId);
  const selectedVehicle = vehicles.find((row) => row.id === vehicleId) || null;
  const vehicleTitle = selectedVehicle ? formatVehicleTitle(selectedVehicle) : '';
  const currentStep = BOOKING_STEPS[step - 1];

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

  async function onSubmit(event: FormEvent) {
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
          headers: { 'Idempotency-Key': idempotencyKeyRef.current },
          body: {
            preferredAt,
            notes: notes || null,
            serviceRequestId: serviceRequestId || null,
            vehicleId: vehicleId || null,
          },
        });
        idempotencyKeyRef.current = crypto.randomUUID();
        navigate(`/dashboard/client/bookings/${booking.id}`, { replace: true });
        return;
      }

      await api('/bookings/guest', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKeyRef.current },
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
      idempotencyKeyRef.current = crypto.randomUUID();
      setStatus('Запись отправлена. Мы свяжемся для подтверждения.');
      trackProductEvent('booking_confirmed', { guest: true });
      setConsent(false);
      setStep(1);
    } catch (error) {
      setStatusError(true);
      setStatus(error instanceof Error ? error.message : 'Не удалось создать запись.');
    } finally {
      setLoading(false);
    }
  }

  const subtitle = selectedVehicle
    ? `Запись на ${vehicleTitle} — выберите время, и мы подготовим приём.`
    : prefill.fromConsultation
      ? 'Осталось выбрать время — данные диагностики уже подставлены.'
      : 'Три шага — и мы подготовим приём вашего автомобиля.';

  const vehicleInitials = selectedVehicle
    ? `${(selectedVehicle.make || '').trim().charAt(0)}${(selectedVehicle.model || '').trim().charAt(0)}`.toUpperCase()
    : '';
  const vehicleMeta = selectedVehicle
    ? [selectedVehicle.licensePlate, selectedVehicle.year ? `${selectedVehicle.year} г.` : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return {
    user,
    isClient,
    quickSlots,
    prefill,
    step,
    notes,
    setNotes,
    fullName,
    setFullName,
    phone,
    setPhone,
    email,
    setEmail,
    preferredAt,
    setPreferredAt,
    serviceRequestId,
    setServiceRequestId,
    requests,
    vehicles,
    vehicleId,
    setVehicleId,
    vehicleLocked,
    consent,
    setConsent,
    consentError,
    setConsentError,
    guestFieldErrors,
    setGuestFieldErrors,
    stepError,
    status,
    statusError,
    loading,
    selectedRequest,
    selectedVehicle,
    vehicleTitle,
    currentStep,
    goNext,
    goBack,
    goToStep,
    onSubmit,
    subtitle,
    vehicleInitials,
    vehicleMeta,
  };
}
