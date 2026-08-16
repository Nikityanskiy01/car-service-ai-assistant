import { ConsultationPhotoGallery } from '../../components/consultation/ConsultationPhotoGallery';
import { ConsultationStagesTimeline } from '../../components/consultation/ConsultationStagesTimeline';
import { AssistantMessage } from '../../components/consultation/AssistantMessage';
import { ConsultationFeedbackPanel } from '../../components/requests/ConsultationFeedbackPanel';
import { RequestCompletionDocumentsPanel } from '../../components/requests/RequestCompletionDocumentsPanel';
import { RequestSummaryPanel } from '../../components/requests/RequestSummaryPanel';
import { SimilarCasesPanel } from '../../components/requests/SimilarCasesPanel';
import { UserMessage } from '../../components/consultation/UserMessage';
import { FollowUpChatPanel } from '../../components/messages/FollowUpChatPanel';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/console/ui/card';
import { Button } from '../../components/console/ui/button';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
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
        <Card>
          <CardContent>
            <RequestSummaryPanel
            request={request}
            integrations={d.integrations}
            calendarPath={d.paths.calendar}
            onFeedbackSaved={(feedback) =>
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
          </CardContent>
        </Card>
      )}

      {d.tab === 'consultation' && (
        <Card className="consultation-thread">
          <CardContent className="flex flex-col gap-3">
          <ConsultationStagesTimeline
            progressPercent={session?.progressPercent}
            hasDiagnosis={Boolean(d.diagnosis)}
            messageCount={session?.messages?.length ?? 0}
          />
          <ConsultationPhotoGallery
            photoObservations={session?.flowState?.photo_observations}
            messageContents={(session?.messages || []).map((message) => message.content)}
          />
          {session?.messages?.length ? (
            session.messages.map((message) =>
              message.sender === 'ASSISTANT' || message.sender === 'assistant' ? (
                <AssistantMessage key={message.id} message={message} />
              ) : (
                <UserMessage key={message.id} message={message} />
              ),
            )
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Клиент пришёл без консультации ИИ либо переписка не сохранилась.
            </p>
          )}
          </CardContent>
        </Card>
      )}

      {d.tab === 'messages' && (
        <FollowUpChatPanel
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
        <div className="flex flex-col gap-3">
          <Card>
            <CardContent>
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
            </CardContent>
          </Card>
          <Card>
            <CardContent>
            <RequestCompletionDocumentsPanel requestId={request.id} requestStatus={request.status} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
            <SimilarCasesPanel requestId={request.id} />
            </CardContent>
          </Card>
        </div>
      )}

      {d.tab === 'history' && (
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle>История</CardTitle>
            </CardHeader>
            <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex gap-3">
                <time className="tnum">{new Date(request.createdAt).toLocaleString('ru-RU')}</time>
                <span>Заявка создана</span>
              </li>
              {d.statusHistory.map((row) => (
                <li key={row.id}>
                  <time className="tnum">{new Date(row.createdAt).toLocaleString('ru-RU')}</time>
                  <span>
                    Статус:{' '}
                    {row.fromStatus
                      ? SERVICE_REQUEST_STATUS_LABELS[row.fromStatus as ServiceRequestStatus] ||
                        row.fromStatus
                      : 'нет'}{' '}
                    → {SERVICE_REQUEST_STATUS_LABELS[row.toStatus as ServiceRequestStatus] || row.toStatus}
                    {row.actor?.fullName ? ` (${row.actor.fullName})` : ''}
                  </span>
                </li>
              ))}
              {d.messages.map((message) => (
                <li key={message.id}>
                  <time className="tnum">{new Date(message.createdAt).toLocaleString('ru-RU')}</time>
                  <span>Отправлено сообщение менеджером</span>
                </li>
              ))}
              {session?.feedback ? (
                <li>
                  <time className="tnum">
                    {new Date(session.feedback.updatedAt).toLocaleString('ru-RU')}
                  </time>
                  <span>Оценка диагноза ИИ сохранена</span>
                </li>
              ) : null}
              {d.integrations?.jobs
                ?.filter((job) => job.status === 'SUCCEEDED')
                .map((job) => (
                  <li key={job.id}>
                    <time className="tnum">{new Date(job.updatedAt).toLocaleString('ru-RU')}</time>
                    <span>Заявка передана в учётную систему</span>
                  </li>
                ))}
            </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Синхронизация с учётной системой</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
            {!d.connections.length ? (
              <p className="text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground">Заявка ещё не передана во внешнюю систему.</p>
            ) : null}
            {d.integrations?.jobs?.length ? (
              <div className="integration-jobs">
                <h3>Последние попытки</h3>
                <ul>
                  {d.integrations.jobs.map((job) => (
                    <li key={job.id}>
                      <IntegrationStatusBadge status={job.status} />
                      <span>{INTEGRATION_JOB_STATUS_LABELS[job.status] || job.status}</span>
                      {job.lastErrorMessage ? <span className="danger">{job.lastErrorMessage}</span> : null}
                      {['FAILED', 'RETRYING', 'DEAD_LETTER'].includes(job.status) ? (
                        <Button variant="ghost" onClick={() => void d.handleRetry(job.connectionId)}>
                          Повторить
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
