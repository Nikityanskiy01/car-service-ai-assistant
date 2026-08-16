import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../../api/client';
import type { ConsultationDetail } from '../../../types/consultation';
import { localizeConsultStreamError, localizeConsultThrownError } from '../../../pages/public/consultPageCopy';
import { useConsultationStream } from '../useConsultationStream';

type ErrorApi = {
  setErrorWithRetry: (msg: string, retry?: () => void) => void;
  clearError: () => void;
};

export function useConsultChat({
  sessionId,
  guestToken,
  online,
  diagnosisPending,
  setDetail,
  errorApi,
}: {
  sessionId: string | null;
  guestToken: string | null;
  online: boolean;
  diagnosisPending: boolean;
  setDetail: (detail: ConsultationDetail) => void;
  errorApi: ErrorApi;
}) {
  const { setErrorWithRetry, clearError } = errorApi;
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const { start, stop } = useConsultationStream();

  useEffect(() => {
    return () => stop();
  }, [stop]);

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
  }, [sessionId, guestToken, diagnosisPending, setDetail]);

  function resetComposer() {
    setMessage('');
    setPhase(null);
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

  return {
    message,
    setMessage,
    isSending,
    phase,
    sendMessage,
    onSend,
    resetComposer,
  };
}
