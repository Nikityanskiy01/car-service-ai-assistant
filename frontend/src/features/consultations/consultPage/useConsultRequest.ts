import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { prefillBookingFromConsultation } from '../../services/prefill';
import { trackProductEvent } from '../../../lib/productEvents';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { getFullNameError, getPhoneError } from '../../../lib/validation';
import type { ConsultationDetail } from '../../../types/consultation';
import type { ConsultGuestFieldErrors, ContactModalIntent } from './types';

type ErrorApi = {
  setErrorWithRetry: (msg: string, retry?: () => void) => void;
  clearError: () => void;
};

export function useConsultRequest({
  sessionId,
  guestToken,
  isAuthenticated,
  detail,
  errorApi,
}: {
  sessionId: string | null;
  guestToken: string | null;
  isAuthenticated: boolean;
  detail: ConsultationDetail | null;
  errorApi: ErrorApi;
}) {
  const navigate = useNavigate();
  const { setErrorWithRetry, clearError } = errorApi;
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestConsent, setGuestConsent] = useState(false);
  const [guestConsentError, setGuestConsentError] = useState<string | null>(null);
  const [guestFieldErrors, setGuestFieldErrors] = useState<ConsultGuestFieldErrors>({});
  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('chat');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalIntent, setContactModalIntent] = useState<ContactModalIntent>('request');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.consultPrefill);
      if (!raw) return;
      const data = JSON.parse(raw) as { fullName?: string; phone?: string };
      if (data.fullName) setGuestName(data.fullName);
      if (data.phone) setGuestPhone(data.phone);
      sessionStorage.removeItem(STORAGE_KEYS.consultPrefill);
    } catch {
      /* ignore */
    }
  }, []);

  function clearSuccess() {
    setSuccessRequestId(null);
  }

  function goToBooking() {
    prefillBookingFromConsultation({
      detail,
      serviceRequestId: successRequestId ?? undefined,
      fullName: !isAuthenticated ? guestName : undefined,
      phone: !isAuthenticated ? guestPhone : undefined,
    });
    navigate('/booking');
  }

  function openContactModal(intent: ContactModalIntent) {
    setContactModalIntent(intent);
    setGuestConsentError(null);
    setContactModalOpen(true);
  }

  function closeContactModal() {
    if (creatingRequest) return;
    setContactModalOpen(false);
    setGuestConsentError(null);
    setGuestFieldErrors({});
  }

  async function createServiceRequest() {
    if (!sessionId || creatingRequest) return;
    if (!isAuthenticated && !guestConsent) {
      setGuestConsentError('Отметьте согласие на обработку персональных данных');
      return;
    }
    setGuestConsentError(null);
    setCreatingRequest(true);
    clearError();
    try {
      const payload = isAuthenticated
        ? await api<{ id: string }>(`/consultations/${sessionId}/service-request`, { method: 'POST' })
        : await api<{ id: string }>(`/consultations/${sessionId}/service-request-guest`, {
            method: 'POST',
            guestToken,
            body: {
              fullName: guestName,
              phone: guestPhone,
              email: null,
              consentPersonalData: true,
            },
          });
      setSuccessRequestId(payload.id);
      trackProductEvent('request_created', { requestId: payload.id });
      setContactModalOpen(false);
      setMobilePanel('result');
    } catch (e) {
      setErrorWithRetry(
        e instanceof Error ? e.message : 'Не удалось создать заявку',
        () => void createServiceRequest(),
      );
    } finally {
      setCreatingRequest(false);
    }
  }

  function handleCreateRequestClick() {
    if (isAuthenticated) {
      void createServiceRequest();
      return;
    }
    openContactModal('request');
  }

  async function submitContactModal() {
    if (!isAuthenticated) {
      const nextErrors: ConsultGuestFieldErrors = {};
      const nameError = getFullNameError(guestName);
      if (nameError) nextErrors.fullName = nameError;
      const phoneError = getPhoneError(guestPhone);
      if (phoneError) nextErrors.phone = phoneError;
      setGuestFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      if (!guestConsent) {
        setGuestConsentError('Отметьте согласие на обработку персональных данных');
        return;
      }
    }
    setGuestConsentError(null);

    if (contactModalIntent === 'login') {
      sessionStorage.setItem(
        STORAGE_KEYS.consultPrefill,
        JSON.stringify({ fullName: guestName.trim(), phone: guestPhone.trim() }),
      );
      setContactModalOpen(false);
      navigate('/login?next=/dashboard/client');
      return;
    }

    await createServiceRequest();
  }

  const sidePanelClass = mobilePanel !== 'result' ? 'consult-panel-hidden-mobile' : '';
  const mainPanelClass = mobilePanel !== 'chat' ? 'consult-panel-hidden-mobile' : '';

  return {
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    guestConsent,
    setGuestConsent,
    guestConsentError,
    setGuestConsentError,
    guestFieldErrors,
    setGuestFieldErrors,
    successRequestId,
    creatingRequest,
    mobilePanel,
    setMobilePanel,
    contactModalOpen,
    contactModalIntent,
    goToBooking,
    openContactModal,
    closeContactModal,
    handleCreateRequestClick,
    submitContactModal,
    clearSuccess,
    sidePanelClass,
    mainPanelClass,
  };
}
