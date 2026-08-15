import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { prefillBookingFromConsultation } from '../services/prefill';
import {
  clearStoredConsultationSession,
  isStaleConsultationAccessError,
} from './consultationAccess';
import { useConsultationStream } from './useConsultationStream';
import { solveAbuseChallenge } from './abusePow';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { trackProductEvent } from '../../lib/productEvents';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { getFullNameError, getPhoneError } from '../../lib/validation';
import type { ConsultationDetail } from '../../types/consultation';
import {
  CONSULT_STAGE_LABELS,
  localizeConsultStreamError,
  localizeConsultThrownError,
} from '../../pages/public/consultPageCopy';

export type ConsultGuestFieldErrors = {
  fullName?: string;
  phone?: string;
};

export function useConsultPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const online = useOnlineStatus();
  const [sessionId, setSessionId] = useState<string | null>(sessionStorage.getItem(STORAGE_KEYS.consultSessionId));
  const [guestToken, setGuestToken] = useState<string | null>(
    sessionStorage.getItem(STORAGE_KEYS.consultGuestToken),
  );
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(!sessionStorage.getItem(STORAGE_KEYS.consultSessionId));
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestConsent, setGuestConsent] = useState(false);
  const [guestConsentError, setGuestConsentError] = useState<string | null>(null);
  const [guestFieldErrors, setGuestFieldErrors] = useState<ConsultGuestFieldErrors>({});

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

  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('chat');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalIntent, setContactModalIntent] = useState<'request' | 'login'>('request');
  const bootRef = useRef(false);
  const diagnosisShownRef = useRef(false);
  const retryRef = useRef<(() => void) | null>(null);
  const { start, stop } = useConsultationStream();
  const stage = String(detail?.flowState?.stage || 'INITIAL');
  const statusText =
    CONSULT_STAGE_LABELS[stage] ||
    (detail?.diagnosis?.execution_meta?.provider
      ? `Источник анализа: ${detail.diagnosis.execution_meta.provider}`
      : CONSULT_STAGE_LABELS.INITIAL);
  const hasUserMessages = (detail?.messages || []).some((m) => m.sender === 'USER');
  const showQuickReplies = !hasUserMessages && !isSending;
  const diagnosisPending = useMemo(() => {
    if (!detail) return false;
    return (
      detail.flowState?.stage === 'DIAGNOSIS_QUEUED' ||
      detail.diagnosisJob?.status === 'PENDING' ||
      detail.diagnosisJob?.status === 'PROCESSING'
    );
  }, [detail]);

  function setErrorWithRetry(msg: string, retry?: () => void) {
    setError(msg);
    retryRef.current = retry ?? null;
  }

  function clearError() {
    setError(null);
    retryRef.current = null;
  }

  async function loadSession(id: string, token?: string | null) {
    const loaded = await api<ConsultationDetail>(`/consultations/${id}`, { guestToken: token });
    setDetail(loaded);
  }

  async function bootstrapSession() {
    clearError();
    setBootstrapping(true);
    setSuccessRequestId(null);
    try {
      const abuseHeaders = user ? undefined : await solveAbuseChallenge();
      const idempotencyKey =
        sessionStorage.getItem(STORAGE_KEYS.consultIdempotencyKey) || crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEYS.consultIdempotencyKey, idempotencyKey);
      const created = await api<{ id: string; guestToken?: string }>('/consultations', {
        method: 'POST',
        body: {},
        headers: { ...(abuseHeaders || {}), 'Idempotency-Key': idempotencyKey },
      });
      trackProductEvent('consult_started', { guest: created.guestToken ? true : false });
      setSessionId(created.id);
      sessionStorage.setItem(STORAGE_KEYS.consultSessionId, created.id);
      if (created.guestToken) {
        setGuestToken(created.guestToken);
        sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, created.guestToken);
        sessionStorage.setItem(STORAGE_KEYS.consultMode, 'guest');
      } else {
        setGuestToken(null);
        sessionStorage.removeItem(STORAGE_KEYS.consultGuestToken);
      }
      const loaded = await api<ConsultationDetail>(`/consultations/${created.id}`, { guestToken: created.guestToken });
      setDetail(loaded);
    } catch (e) {
      setErrorWithRetry(
        e instanceof Error ? e.message : 'Не удалось создать консультацию',
        () => void bootstrapSession(),
      );
      throw e;
    } finally {
      setBootstrapping(false);
    }
  }

  async function openConsultationSession() {
    const existingId = sessionStorage.getItem(STORAGE_KEYS.consultSessionId);
    const existingToken = sessionStorage.getItem(STORAGE_KEYS.consultGuestToken);
    if (!existingId) {
      await bootstrapSession();
      return;
    }
    try {
      await loadSession(existingId, existingToken);
      setSessionId(existingId);
      setGuestToken(existingToken);
    } catch (e) {
      if (isStaleConsultationAccessError(e)) {
        clearStoredConsultationSession();
        setSessionId(null);
        setGuestToken(null);
        setDetail(null);
        await bootstrapSession();
        return;
      }
      throw e;
    }
  }

  async function refreshSession() {
    if (!sessionId) return;
    clearError();
    setBootstrapping(true);
    try {
      await loadSession(sessionId, guestToken);
    } catch (e) {
      if (isStaleConsultationAccessError(e)) {
        clearStoredConsultationSession();
        setSessionId(null);
        setGuestToken(null);
        setDetail(null);
        await bootstrapSession();
        return;
      }
      setErrorWithRetry(
        e instanceof Error ? e.message : 'Не удалось обновить консультацию',
        () => void refreshSession(),
      );
    } finally {
      setBootstrapping(false);
    }
  }

  function handleRetry() {
    clearError();
    if (retryRef.current) {
      retryRef.current();
      return;
    }
    if (sessionId) {
      void refreshSession();
      return;
    }
    void bootstrapSession();
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

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    void (async () => {
      try {
        setBootstrapping(true);
        await openConsultationSession();
      } catch (e) {
        setErrorWithRetry(
          e instanceof Error ? e.message : 'Не удалось открыть консультацию',
          () => void openConsultationSession(),
        );
      } finally {
        setBootstrapping(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once bootstrap
  }, []);

  useEffect(() => {
    if (!sessionId || !diagnosisPending) return;
    setPhase('diagnosing');
    const timer = window.setInterval(() => {
      void api<ConsultationDetail>(`/consultations/${sessionId}`, { guestToken }).then((loaded) => {
        setDetail(loaded);
        if (loaded.status === 'COMPLETED' || loaded.diagnosisJob?.status === 'FAILED') {
          setPhase(null);
        }
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [sessionId, guestToken, diagnosisPending]);

  useEffect(() => {
    if (diagnosisShownRef.current) return;
    if (!detail?.diagnosis || diagnosisPending) return;
    diagnosisShownRef.current = true;
    trackProductEvent('diagnosis_shown', {
      sessionId: sessionId || '',
      provider: String(detail.diagnosis.execution_meta?.provider || ''),
    });
  }, [detail, diagnosisPending, sessionId]);

  async function startNewSession() {
    clearStoredConsultationSession();
    setSessionId(null);
    setGuestToken(null);
    setDetail(null);
    setMessage('');
    setPhase(null);
    setMobilePanel('chat');
    await bootstrapSession();
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!sessionId || !trimmed || isSending || !online) return;
    setIsSending(true);
    clearError();
    setPhase('started');
    try {
      await start({
        sessionId,
        content: trimmed,
        guestToken,
        handlers: {
          onThinking: () => setPhase('started'),
          onProgress: (payload) => {
            const p = payload as { phase?: string };
            if (p?.phase) setPhase(p.phase);
          },
          onDone: (payload) => {
            const loaded = payload as ConsultationDetail;
            setDetail(loaded);
            const pending =
              loaded.flowState?.stage === 'DIAGNOSIS_QUEUED' ||
              loaded.diagnosisJob?.status === 'PENDING' ||
              loaded.diagnosisJob?.status === 'PROCESSING';
            setPhase(pending ? 'diagnosing' : null);
          },
          onError: (payload) => {
            setPhase(null);
            setErrorWithRetry(localizeConsultStreamError(payload), () => void sendMessage(trimmed));
          },
        },
      });
      setMessage('');
    } catch (e) {
      setPhase(null);
      setErrorWithRetry(localizeConsultThrownError(e), () => void sendMessage(trimmed));
    } finally {
      setIsSending(false);
    }
  }

  async function onSend(event?: FormEvent) {
    event?.preventDefault();
    await sendMessage(message);
  }

  function openContactModal(intent: 'request' | 'login') {
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
    isAuthenticated,
    user,
    online,
    sessionId,
    guestToken,
    detail,
    message,
    setMessage,
    isSending,
    phase,
    error,
    bootstrapping,
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
    stage,
    statusText,
    showQuickReplies,
    handleRetry,
    goToBooking,
    startNewSession,
    sendMessage,
    onSend,
    openContactModal,
    closeContactModal,
    handleCreateRequestClick,
    submitContactModal,
    loadSession,
    refreshSession,
    setErrorWithRetry,
    sidePanelClass,
    mainPanelClass,
  };
}
