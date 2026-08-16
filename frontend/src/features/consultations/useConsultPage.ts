import { useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { ConsultGuestFieldErrors } from './consultPage/types';
import { useConsultError } from './consultPage/useConsultError';
import { useConsultSession } from './consultPage/useConsultSession';
import { useConsultChat } from './consultPage/useConsultChat';
import { useConsultRequest } from './consultPage/useConsultRequest';

export type { ConsultGuestFieldErrors };

export function useConsultPage() {
  const { isAuthenticated, user } = useAuth();
  const online = useOnlineStatus();
  const errorApi = useConsultError();
  const successResetRef = useRef<() => void>(() => {});
  const session = useConsultSession({
    user,
    errorApi,
    onBootstrap: () => successResetRef.current(),
  });
  const chat = useConsultChat({
    sessionId: session.sessionId,
    guestToken: session.guestToken,
    online,
    diagnosisPending: session.diagnosisPending,
    setDetail: session.setDetail,
    errorApi,
  });
  const request = useConsultRequest({
    sessionId: session.sessionId,
    guestToken: session.guestToken,
    isAuthenticated,
    detail: session.detail,
    errorApi,
  });
  successResetRef.current = request.clearSuccess;

  const showQuickReplies = !session.hasUserMessages && !chat.isSending;

  function handleRetry() {
    errorApi.handleRetry(() => {
      if (session.sessionId) {
        void session.refreshSession();
        return;
      }
      void session.bootstrapSession();
    });
  }

  async function startNewSession() {
    chat.resetComposer();
    request.setMobilePanel('chat');
    await session.startNewSession();
  }

  return {
    isAuthenticated,
    user,
    online,
    sessionId: session.sessionId,
    guestToken: session.guestToken,
    detail: session.detail,
    message: chat.message,
    setMessage: chat.setMessage,
    isSending: chat.isSending,
    phase: chat.phase,
    error: errorApi.error,
    bootstrapping: session.bootstrapping,
    guestName: request.guestName,
    setGuestName: request.setGuestName,
    guestPhone: request.guestPhone,
    setGuestPhone: request.setGuestPhone,
    guestConsent: request.guestConsent,
    setGuestConsent: request.setGuestConsent,
    guestConsentError: request.guestConsentError,
    setGuestConsentError: request.setGuestConsentError,
    guestFieldErrors: request.guestFieldErrors,
    setGuestFieldErrors: request.setGuestFieldErrors,
    successRequestId: request.successRequestId,
    creatingRequest: request.creatingRequest,
    mobilePanel: request.mobilePanel,
    setMobilePanel: request.setMobilePanel,
    contactModalOpen: request.contactModalOpen,
    contactModalIntent: request.contactModalIntent,
    stage: session.stage,
    statusText: session.statusText,
    showQuickReplies,
    handleRetry,
    goToBooking: request.goToBooking,
    startNewSession,
    sendMessage: chat.sendMessage,
    onSend: chat.onSend,
    openContactModal: request.openContactModal,
    closeContactModal: request.closeContactModal,
    handleCreateRequestClick: request.handleCreateRequestClick,
    submitContactModal: request.submitContactModal,
    loadSession: session.loadSession,
    refreshSession: session.refreshSession,
    setErrorWithRetry: errorApi.setErrorWithRetry,
    sidePanelClass: request.sidePanelClass,
    mainPanelClass: request.mainPanelClass,
  };
}

export type ConsultPageModel = ReturnType<typeof useConsultPage>;
