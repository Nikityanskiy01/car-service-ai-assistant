import { ConsultationPhotoGallery } from '../../components/consultation/ConsultationPhotoGallery';
import { ConsultationStagesTimeline } from '../../components/consultation/ConsultationStagesTimeline';
import { AssistantMessage } from '../../components/consultation/AssistantMessage';
import { MasterChecksChecklist } from '../../components/consultation/MasterChecksChecklist';
import { ConsultationFeedbackPanel } from '../../components/requests/ConsultationFeedbackPanel';
import { RequestAiBrief } from '../../components/requests/RequestAiBrief';
import { RequestCompletionDocumentsPanel } from '../../components/requests/RequestCompletionDocumentsPanel';
import { RequestSummaryPanel } from '../../components/requests/RequestSummaryPanel';
import { SimilarCasesPanel } from '../../components/requests/SimilarCasesPanel';
import { UserMessage } from '../../components/consultation/UserMessage';
import { FollowUpChatPanel } from '../../components/messages/FollowUpChatPanel';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/console/ui/button';
import { MESSAGE_TEMPLATES } from '../../lib/messageTemplates';
import {
  buildDiagnosisRecommendations,
  getSessionDiagnosis,
} from '../../lib/managerRequestHelpers';
import type { ConsultationFeedback } from '../../types/serviceRequest';
import type { LoadedManagerRequest } from './useManagerRequestDetail';
import { ManagerRequestHistoryTab } from './ManagerRequestHistoryTab';

function applyFeedback(d: LoadedManagerRequest) {
  return (feedback: ConsultationFeedback) => {
    d.setRequest((prev) =>
      prev
        ? {
            ...prev,
            consultationSession: prev.consultationSession
              ? { ...prev.consultationSession, feedback }
              : prev.consultationSession,
          }
        : prev,
    );
  };
}

export function ManagerRequestPanels({ d }: { d: LoadedManagerRequest }) {
  const { request, session } = d;
  const diagnosis = getSessionDiagnosis(session);
  const recommendations = buildDiagnosisRecommendations(request);
  const checks = Array.isArray(diagnosis?.recommended_checks) ? diagnosis.recommended_checks : [];
  const summary = String(diagnosis?.summary || '').trim();
  const hasThread = Boolean(session?.messages?.length);
  const hasAiBrief = recommendations.length > 0 || Boolean(summary);

  return (
    <>
      {d.tab === 'summary' && (
        <RequestSummaryPanel
          request={request}
          integrations={d.integrations}
          calendarPath={d.paths.calendar}
          phone={d.phone}
          onBook={() => d.openBooking()}
          onOpenMessages={() => d.setTab('messages')}
          onOpenConsultation={() => d.setTab('consultation')}
        />
      )}

      {d.tab === 'consultation' &&
        (hasThread || hasAiBrief ? (
          <div className="request-consultation">
            <div className="request-consultation-main">
              {hasAiBrief ? (
                <RequestAiBrief
                  recommendations={recommendations}
                  overallConfidence={diagnosis?.confidence}
                  summary={summary}
                />
              ) : null}
              {hasThread ? (
                <section className="request-thread">
                  {!hasAiBrief ? (
                    <ConsultationStagesTimeline
                      progressPercent={session?.progressPercent}
                      hasDiagnosis={Boolean(d.diagnosis)}
                      messageCount={session?.messages?.length ?? 0}
                    />
                  ) : null}
                  <ConsultationPhotoGallery
                    photoObservations={session?.flowState?.photo_observations}
                    messageContents={(session?.messages ?? []).map((message) => message.content)}
                  />
                  <header className="request-thread-head">
                    <h2>Переписка с ассистентом</h2>
                  </header>
                  <div className="request-thread-log">
                    {(session?.messages ?? []).map((message) =>
                      message.sender === 'ASSISTANT' || message.sender === 'assistant' ? (
                        <AssistantMessage key={message.id} message={message} />
                      ) : (
                        <UserMessage key={message.id} message={message} />
                      ),
                    )}
                  </div>
                </section>
              ) : (
                <EmptyState
                  title="Диалога ещё нет"
                  description="Гипотезы уже есть. Когда клиент напишет ассистенту, переписка появится здесь."
                />
              )}
            </div>
            <div className="request-ai-eval">
              <ConsultationFeedbackPanel
                variant="evaluation"
                requestId={request.id}
                initial={session?.feedback}
                onSaved={applyFeedback(d)}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            title="Консультации ИИ не было"
            description="Клиент написал напрямую. Разбор и запись ведите со сводки и переписки."
            action={
              <div className="request-empty-actions">
                <Button type="button" variant="outline" onClick={() => d.setTab('messages')}>
                  Открыть переписку
                </Button>
                <Button type="button" variant="ghost" onClick={() => d.setTab('summary')}>
                  К сводке
                </Button>
              </div>
            }
          />
        ))}

      {d.tab === 'messages' && (
        <FollowUpChatPanel
          title="Переписка с клиентом"
          subtitle="Ответы человеку по этой заявке, не диалог с ассистентом."
          messages={d.messages}
          value={d.reply}
          onChange={d.setReply}
          onSubmit={d.submitReply}
          disabled={d.threadClosed}
          sending={d.sending}
          error={null}
          placeholder="Ответ клиенту…"
          attachments={d.pendingAttachments}
          onAttachmentsChange={d.setPendingAttachments}
          templates={
            d.threadClosed
              ? undefined
              : MESSAGE_TEMPLATES.map((template) => ({
                  id: template.id,
                  label: template.label,
                  body: template.body,
                }))
          }
          closedMessage={
            d.threadClosed ? 'Переписка закрыта: заявка завершена или отменена.' : undefined
          }
          viewerRole="MANAGER"
          emptyTitle="Сообщений пока нет"
          emptyDescription="Напишите клиенту первое сообщение."
        />
      )}

      {d.tab === 'works' && (
        <div className="request-works">
          <div className="request-works-stack">
            {checks.length ? (
              <div className="request-works-checks">
                <MasterChecksChecklist
                  checks={checks}
                  title="В сервис"
                  hint="Отметьте, что уже проверили. Список только на этом экране."
                />
              </div>
            ) : null}
            <div className="request-works-main">
              <ConsultationFeedbackPanel
                variant="works"
                requestId={request.id}
                initial={session?.feedback}
                onSaved={applyFeedback(d)}
                onNeedEvaluation={() => d.setTab('consultation')}
              />
            </div>
          </div>
          <div className="request-works-side">
            <RequestCompletionDocumentsPanel requestId={request.id} requestStatus={request.status} />
            <SimilarCasesPanel requestId={request.id} />
          </div>
        </div>
      )}

      {d.tab === 'history' && <ManagerRequestHistoryTab d={d} />}
    </>
  );
}
