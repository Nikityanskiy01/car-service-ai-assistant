import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../api/client';
import { trackProductEvent } from '../../../lib/productEvents';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import type { ConsultationDetail } from '../../../types/consultation';
import { CONSULT_STAGE_LABELS } from '../../../pages/public/consultPageCopy';
import {
  clearStoredConsultationSession,
  isStaleConsultationAccessError,
} from '../consultationAccess';
import { solveAbuseChallenge } from '../abusePow';

type ErrorApi = {
  setErrorWithRetry: (msg: string, retry?: () => void) => void;
  clearError: () => void;
};

export function useConsultSession({
  user,
  errorApi,
  onBootstrap,
}: {
  user: unknown;
  errorApi: ErrorApi;
  onBootstrap?: () => void;
}) {
  const { setErrorWithRetry, clearError } = errorApi;
  const [sessionId, setSessionId] = useState<string | null>(sessionStorage.getItem(STORAGE_KEYS.consultSessionId));
  const [guestToken, setGuestToken] = useState<string | null>(
    sessionStorage.getItem(STORAGE_KEYS.consultGuestToken),
  );
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [bootstrapping, setBootstrapping] = useState(!sessionStorage.getItem(STORAGE_KEYS.consultSessionId));
  const bootRef = useRef(false);
  const diagnosisShownRef = useRef(false);

  const stage = String(detail?.flowState?.stage || 'INITIAL');
  const statusText =
    CONSULT_STAGE_LABELS[stage] ||
    (detail?.diagnosis?.execution_meta?.provider
      ? `Источник анализа: ${detail.diagnosis.execution_meta.provider}`
      : CONSULT_STAGE_LABELS.INITIAL);
  const hasUserMessages = (detail?.messages || []).some((m) => m.sender === 'USER');
  const diagnosisPending = useMemo(() => {
    if (!detail) return false;
    return (
      detail.flowState?.stage === 'DIAGNOSIS_QUEUED' ||
      detail.diagnosisJob?.status === 'PENDING' ||
      detail.diagnosisJob?.status === 'PROCESSING'
    );
  }, [detail]);

  async function loadSession(id: string, token?: string | null) {
    const loaded = await api<ConsultationDetail>(`/consultations/${id}`, { guestToken: token });
    setDetail(loaded);
  }

  async function bootstrapSession() {
    clearError();
    setBootstrapping(true);
    onBootstrap?.();
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

  async function startNewSession() {
    clearStoredConsultationSession();
    setSessionId(null);
    setGuestToken(null);
    setDetail(null);
    await bootstrapSession();
  }

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
    if (diagnosisShownRef.current) return;
    if (!detail?.diagnosis || diagnosisPending) return;
    diagnosisShownRef.current = true;
    trackProductEvent('diagnosis_shown', {
      sessionId: sessionId || '',
      provider: String(detail.diagnosis.execution_meta?.provider || ''),
    });
  }, [detail, diagnosisPending, sessionId]);

  return {
    sessionId,
    guestToken,
    detail,
    setDetail,
    bootstrapping,
    stage,
    statusText,
    hasUserMessages,
    diagnosisPending,
    loadSession,
    bootstrapSession,
    refreshSession,
    startNewSession,
  };
}
