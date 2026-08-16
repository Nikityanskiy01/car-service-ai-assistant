import { ConsultationPhotoGallery } from '../../components/consultation/ConsultationPhotoGallery';
import { ConsultationStagesTimeline } from '../../components/consultation/ConsultationStagesTimeline';
import { AssistantMessage } from '../../components/consultation/AssistantMessage';
import { ConsultationFeedbackPanel } from '../../components/requests/ConsultationFeedbackPanel';
import { RequestCompletionDocumentsPanel } from '../../components/requests/RequestCompletionDocumentsPanel';
import { RequestSummaryPanel } from '../../components/requests/RequestSummaryPanel';
import { SimilarCasesPanel } from '../../components/requests/SimilarCasesPanel';
import { UserMessage } from '../../components/consultation/UserMessage';
import { FollowUpChatPanel } from '../../components/messages/FollowUpChatPanel';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/console/ui/button';
import { MESSAGE_TEMPLATES } from '../../lib/messageTemplates';
import {
  INTEGRATION_JOB_STATUS_LABELS,
  INTEGRATION_PROVIDER_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
} from '../../lib/labels';
import type { ServiceRequestStatus } from '../../types/serviceRequest';
import type { LoadedManagerRequest } from './useManagerRequestDetail';

export function ManagerRequestPanels({ d }: { d: LoadedManagerRequest }) {
  const { request, session } = d;

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
        />
      )}

      {d.tab === 'consultation' &&
        (session?.messages?.length ? (
          <section className="request-thread">
            <ConsultationStagesTimeline
              progressPercent={session?.progressPercent}
              hasDiagnosis={Boolean(d.diagnosis)}
              messageCount={session.messages.length}
            />
            <ConsultationPhotoGallery
              photoObservations={session?.flowState?.photo_observations}
              messageContents={session.messages.map((message) => message.content)}
            />
            <div className="request-thread-log">
              {session.messages.map((message) =>
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
          title="Переписка"
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
          <div className="request-works-eval">
            <ConsultationFeedbackPanel
              requestId={request.id}
              initial={session?.feedback}
              onSaved={(feedback) =>
                d.setRequest((prev) =>
                  prev
                    ? {
                        ...prev,
                        consultationSession: prev.consultationSession
                          ? { ...prev.consultationSession, feedback }
                          : prev.consultationSession,
                      }
                    : prev,
                )
              }
            />
          </div>
          <div className="request-works-side">
            <RequestCompletionDocumentsPanel requestId={request.id} requestStatus={request.status} />
            <SimilarCasesPanel requestId={request.id} />
          </div>
        </div>
      )}

      {d.tab === 'history' && (
        <div className="request-history-desk">
          <section className="request-history-col">
            <h2>История</h2>
            <ol className="request-timeline">
              <li>
                <time className="tnum">{new Date(request.createdAt).toLocaleString('ru-RU')}</time>
                <p>Заявка создана</p>
              </li>
              {d.statusHistory.map((row) => (
                <li key={row.id}>
                  <time className="tnum">{new Date(row.createdAt).toLocaleString('ru-RU')}</time>
                  <p>
                    Статус:{' '}
                    {row.fromStatus
                      ? SERVICE_REQUEST_STATUS_LABELS[row.fromStatus as ServiceRequestStatus] ||
                        row.fromStatus
                      : 'нет'}{' '}
                    → {SERVICE_REQUEST_STATUS_LABELS[row.toStatus as ServiceRequestStatus] || row.toStatus}
                    {row.actor?.fullName ? ` (${row.actor.fullName})` : ''}
                  </p>
                </li>
              ))}
              {d.messages.map((message) => (
                <li key={message.id}>
                  <time className="tnum">{new Date(message.createdAt).toLocaleString('ru-RU')}</time>
                  <p>Отправлено сообщение менеджером</p>
                </li>
              ))}
              {session?.feedback ? (
                <li>
                  <time className="tnum">
                    {new Date(session.feedback.updatedAt).toLocaleString('ru-RU')}
                  </time>
                  <p>Оценка диагноза ИИ сохранена</p>
                </li>
              ) : null}
              {d.integrations?.jobs
                ?.filter((job) => job.status === 'SUCCEEDED')
                .map((job) => (
                  <li key={job.id}>
                    <time className="tnum">{new Date(job.updatedAt).toLocaleString('ru-RU')}</time>
                    <p>Заявка передана в учётную систему</p>
                  </li>
                ))}
            </ol>
          </section>

          <section className="request-history-col">
            <h2>Учётная система</h2>
            {!d.connections.length ? (
              <p className="request-history-note">
                Администратор может подключить CRM в разделе интеграций.
              </p>
            ) : null}
            {d.integrations?.links?.length ? (
              <ul className="integration-links">
                {d.integrations.links.map((link) => (
                  <li key={link.connectionId}>
                    <strong>{link.connectionName}</strong>
                    <span>{INTEGRATION_PROVIDER_LABELS[link.provider]}</span>
                    <span className="tnum">Внешний номер: {link.externalEntityId}</span>
                    {link.externalUrl ? (
                      <a href={link.externalUrl} target="_blank" rel="noreferrer">
                        Открыть во внешней системе
                      </a>
                    ) : null}
                    <small className="tnum">
                      Синхронизировано: {new Date(link.synchronizedAt).toLocaleString('ru-RU')}
                    </small>
                  </li>
                ))}
              </ul>
            ) : d.connections.length ? (
              <p className="request-history-note">Заявка ещё не передана во внешнюю систему.</p>
            ) : null}
            {d.integrations?.jobs?.length ? (
              <div className="request-jobs">
                <h3>Последние попытки</h3>
                <ul>
                  {d.integrations.jobs.map((job) => (
                    <li key={job.id} className="request-job">
                      <div className="request-job-head">
                        <span className={`integration-status-badge status-${job.status.toLowerCase()}`}>
                          {INTEGRATION_JOB_STATUS_LABELS[job.status] || job.status}
                        </span>
                      </div>
                      {job.lastErrorMessage ? <p className="request-job-error">{job.lastErrorMessage}</p> : null}
                      {['FAILED', 'RETRYING', 'DEAD_LETTER'].includes(job.status) ? (
                        <Button variant="ghost" size="sm" onClick={() => void d.handleRetry(job.connectionId)}>
                          Повторить
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
