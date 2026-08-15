import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnalysisProgress } from '../../components/consultation/AnalysisProgress';
import { ConsultationChat } from '../../components/consultation/ConsultationChat';
import { ConsultationChatComposer } from '../../components/consultation/ConsultationChatComposer';
import { ConsultationProgress } from '../../components/consultation/ConsultationProgress';
import { DiagnosticSummary } from '../../components/consultation/DiagnosticSummary';
import { ObdCodesPanel } from '../../components/consultation/ObdCodesPanel';
import { QuickReplies } from '../../components/consultation/QuickReplies';
import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { managerZonePaths } from '../../config/managerPaths';
import { useConsultPage } from '../../features/consultations/useConsultPage';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';

export function ConsultPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Интеллектуальная диагностика',
    description: 'Чат-диагностика симптомов до записи в автосервис.',
  });
  const {
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
  } = useConsultPage();

  return (
    <div className="fm-page consultation-page">
      <header className="consultation-page-head consult-head">
        <div>
          <h1>Интеллектуальная диагностика автомобиля</h1>
          <p>
            Опишите симптомы своими словами — «{productConfig.assistantName}» уточнит детали и подготовит предварительный
            отчёт. Это не замена осмотра на посту.
          </p>
        </div>
        <div className="consult-head-actions">
          <Button variant="ghost" type="button" onClick={() => void startNewSession()} disabled={bootstrapping || isSending}>
            <Plus size={16} aria-hidden="true" />
            Новая сессия
          </Button>
        </div>
      </header>

      {!isAuthenticated ? (
        <div className="consult-guest-banner" role="status">
          Гостевой режим: история сохранится в этой сессии браузера.{' '}
          <button type="button" className="consult-guest-banner__link" onClick={() => openContactModal('login')}>
            Войдите
          </button>
          , чтобы вести обращения в кабинете.
        </div>
      ) : null}

      {successRequestId ? (
        <div className="success-block consult-success-banner" role="status" aria-live="polite">
          <h4>Заявка создана</h4>
          <p>
            Номер заявки: <strong>{formatRequestNumber(successRequestId)}</strong>
          </p>
          <p>
            Статус: <strong>{SERVICE_REQUEST_STATUS_LABELS.NEW}</strong>
          </p>
          <p className="consult-success-hint">
            Менеджер свяжется с вами для подтверждения деталей и времени записьа.
          </p>
          <div className="consult-success-actions">
            <Button type="button" variant="primary" onClick={goToBooking}>
              Выбрать время записи
            </Button>
            {isAuthenticated ? (
              <Link
                className="btn btn-secondary"
                to={
                  user?.role === 'CLIENT'
                    ? '/dashboard/client/cases'
                    : `${managerZonePaths(user?.role === 'ADMINISTRATOR').requests}/${successRequestId}`
                }
              >
                {user?.role === 'CLIENT' ? 'В кабинет' : 'Открыть заявку'}
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => openContactModal('login')}>
                Войти в кабинет
              </button>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="consult-error-wrap">
          <ErrorState message={error} onRetry={handleRetry} />
        </div>
      ) : null}

      {bootstrapping && !detail ? (
        <Loader label="Открываем чат диагностики..." />
      ) : (
        <>
          <Tabs
            className="consult-mobile-tabs"
            items={[
              { id: 'chat', label: 'Чат' },
              { id: 'result', label: 'Результат' },
            ]}
            value={mobilePanel}
            onChange={setMobilePanel}
          />

          <div className="consultation-layout consultation-layout-fox">
            <aside className={`consultation-side ${sidePanelClass}`}>
              <ConsultationProgress
                progress={detail?.progressPercent ?? 0}
                phase={phase}
                stage={stage}
                statusText={statusText}
                extracted={detail?.extracted}
              />
              <ObdCodesPanel
                currentCodes={detail?.extracted?.obdCodes}
                disabled={isSending || bootstrapping || !sessionId || !online}
                onApply={(msg) => void sendMessage(msg)}
              />
              <DiagnosticSummary
                detail={detail}
                recommendations={detail?.recommendations || []}
                diagnosis={detail?.diagnosis}
                fallbackCost={detail?.costFromMinor}
                fallbackConfidence={detail?.confidencePercent}
                onCreateRequest={handleCreateRequestClick}
              />
            </aside>

            <main className={`consultation-main ${mainPanelClass}`}>
              <AnalysisProgress phase={phase} online={online} />
              {!online ? (
                <div className="consult-offline-banner" role="alert">
                  Нет интернета — сообщения не отправятся. Проверьте Wi‑Fi или мобильную сеть.
                </div>
              ) : null}
              <Card className="consult-chat-card">
                <div className="consult-chat-body">
                  <ConsultationChat
                    messages={detail?.messages || []}
                    isTyping={!!phase && isSending}
                    assistantName={productConfig.assistantName}
                  />
                  {showQuickReplies ? (
                    <QuickReplies
                      disabled={isSending || !sessionId || bootstrapping || !online}
                      onSelect={(reply) => void sendMessage(reply)}
                    />
                  ) : null}
                </div>
                <ConsultationChatComposer
                  message={message}
                  onMessageChange={setMessage}
                  onSubmit={() => onSend()}
                  disabled={isSending || bootstrapping || !sessionId || !online}
                  isSending={isSending}
                  sessionId={sessionId || ''}
                  guestToken={guestToken}
                  onPhotoAnalyzed={() => {
                    if (sessionId) void loadSession(sessionId, guestToken);
                  }}
                  onPhotoError={(msg) => setErrorWithRetry(msg, () => void refreshSession())}
                />
              </Card>
            </main>
          </div>

          <Modal
            open={contactModalOpen}
            title={contactModalIntent === 'login' ? 'Вход в кабинет' : 'Заявка в сервис'}
            onClose={closeContactModal}
          >
            <p className="consult-request-hint">
              {contactModalIntent === 'login'
                ? 'Оставьте контакты — мы сохраним обращение и откроем личный кабинет.'
                : 'Оставьте контакты — менеджер свяжется с вами и подтвердит детали.'}
            </p>
            <div className="fm-form consult-request-form stack">
              <FormField
                label="Ваше имя"
                htmlFor="consultGuestNameModal"
                hint="Менеджер обратится к вам по имени"
                error={guestFieldErrors.fullName}
              >
                <Input
                  name="fullName"
                  autoComplete="name"
                  required
                  placeholder="Иван Иванов"
                  value={guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    if (guestFieldErrors.fullName) setGuestFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                />
              </FormField>
              <FormField
                label="Телефон"
                htmlFor="consultGuestPhoneModal"
                hint="Для звонка или сообщения с деталями"
                error={guestFieldErrors.phone}
              >
                <PhoneInput
                  name="phone"
                  required
                  value={guestPhone}
                  onChange={(value) => {
                    setGuestPhone(value);
                    if (guestFieldErrors.phone) setGuestFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                />
              </FormField>
              <ConsentCheckbox
                id="consultGuestConsentModal"
                checked={guestConsent}
                onChange={(v) => {
                  setGuestConsent(v);
                  if (v) setGuestConsentError(null);
                }}
                error={guestConsentError}
              />
              <Button
                type="button"
                variant="primary"
                className="consult-request-btn"
                disabled={creatingRequest}
                onClick={() => void submitContactModal()}
              >
                {creatingRequest
                  ? 'Отправка...'
                  : contactModalIntent === 'login'
                    ? 'Продолжить ко входу'
                    : 'Отправить заявку'}
              </Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
