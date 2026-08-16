import { AnalysisProgress } from '../../../components/consultation/AnalysisProgress';
import { ConsultationChat } from '../../../components/consultation/ConsultationChat';
import { ConsultationChatComposer } from '../../../components/consultation/ConsultationChatComposer';
import { ConsultationProgress } from '../../../components/consultation/ConsultationProgress';
import { DiagnosticSummary } from '../../../components/consultation/DiagnosticSummary';
import { ObdCodesPanel } from '../../../components/consultation/ObdCodesPanel';
import { QuickReplies } from '../../../components/consultation/QuickReplies';
import { Card } from '../../../components/ui/Card';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import type { ConsultPageModel } from '../useConsultPage';

export function ConsultWorkspace({
  page,
  assistantName,
}: {
  page: ConsultPageModel;
  assistantName: string;
}) {
  const {
    bootstrapping,
    detail,
    mobilePanel,
    setMobilePanel,
    sidePanelClass,
    mainPanelClass,
    phase,
    stage,
    statusText,
    isSending,
    sessionId,
    online,
    sendMessage,
    handleCreateRequestClick,
    showQuickReplies,
    message,
    setMessage,
    onSend,
    guestToken,
    loadSession,
    setErrorWithRetry,
    refreshSession,
  } = page;

  if (bootstrapping && !detail) {
    return <Loader label="Открываем чат диагностики..." />;
  }

  return (
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
                assistantName={assistantName}
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
    </>
  );
}
