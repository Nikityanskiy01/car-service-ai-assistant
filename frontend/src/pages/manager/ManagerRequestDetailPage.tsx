import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone } from 'lucide-react';
import {
  exportRequestToCrm,
  getRequestIntegrations,
  listManagerIntegrations,
  retryRequestIntegration,
} from '../../api/integrations';
import {
  assignRequestToMe,
  assignRequestToManager,
  getRequestStatusHistory,
  getServiceRequest,
  listRequestMessages,
  patchServiceRequestStatus,
  sendRequestMessage,
  type StatusHistoryItem,
} from '../../api/dashboard';
import { ApiError } from '../../api/errors';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import {
  getRequestConfidence,
  getRequestUrgency,
  getSessionDiagnosis,
} from '../../lib/managerRequestHelpers';
import { ConsultationPhotoGallery } from '../../components/consultation/ConsultationPhotoGallery';
import { ConsultationStagesTimeline } from '../../components/consultation/ConsultationStagesTimeline';
import { AssistantMessage } from '../../components/consultation/AssistantMessage';
import { ConsultationFeedbackPanel } from '../../components/requests/ConsultationFeedbackPanel';
import { RequestSummaryPanel } from '../../components/requests/RequestSummaryPanel';
import { SimilarCasesPanel } from '../../components/requests/SimilarCasesPanel';
import { UserMessage } from '../../components/consultation/UserMessage';
import { ManagerPicker } from '../../components/manager/ManagerPicker';
import { FollowUpChatPanel } from '../../components/messages/FollowUpChatPanel';
import { MessageAttachmentInput, type PendingAttachment } from '../../components/requests/MessageAttachmentInput';
import { RequestStatusSelector } from '../../components/requests/RequestStatusSelector';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { UrgencyBadge } from '../../components/consultation/UrgencyBadge';
import { MESSAGE_TEMPLATES } from '../../lib/messageTemplates';
import {
  formatRequestNumber,
  INTEGRATION_JOB_STATUS_LABELS,
  INTEGRATION_PROVIDER_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
} from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { RequestIntegrationStatus } from '../../types/integration';
import type { IntegrationConnection } from '../../types/integration';
import type { ServiceRequestDetail, ServiceRequestStatus } from '../../types/serviceRequest';
import type { FollowUpMessage } from '../../api/dashboard';
import type { ConsultationDetail } from '../../types/consultation';

export function ManagerRequestDetailPage() {
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  usePageMeta({ title: 'Заявка', description: 'Подробная карточка обращения.' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [integrations, setIntegrations] = useState<RequestIntegrationStatus | null>(null);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [tab, setTab] = useState('summary');
  const [reply, setReply] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [assignManagerId, setAssignManagerId] = useState('');
  const [sending, setSending] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportConnectionId, setExportConnectionId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);

  async function load() {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const [req, msgs, integ] = await Promise.all([
        getServiceRequest(requestId),
        listRequestMessages(requestId).catch(() => []),
        getRequestIntegrations(requestId).catch(() => ({ links: [], jobs: [] })),
      ]);
      setRequest(req);
      setMessages(msgs);
      setIntegrations(integ);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [requestId]);

  useEffect(() => {
    void listManagerIntegrations()
      .then((rows) =>
        setConnections(
          rows.map((c) => ({
            ...c,
            capabilities: c.capabilities || { pushRequests: true },
          })) as IntegrationConnection[],
        ),
      )
      .catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    if (tab !== 'history' || !requestId) return;
    void getRequestStatusHistory(requestId)
      .then((data) => setStatusHistory(data.items))
      .catch(() => setStatusHistory([]));
  }, [tab, requestId]);

  const owner = request?.client?.fullName || request?.guestName || 'Гость';
  const phone = request?.client?.phone || request?.guestPhone || '';
  const car = `${request?.snapshotMake || ''} ${request?.snapshotModel || ''}`.trim() || 'Не указан';
  const session = request?.consultationSession;
  const diagnosis = getSessionDiagnosis(session);
  const confidence = getRequestConfidence(session);
  const urgency = getRequestUrgency(session);

  const exportableConnections = useMemo(
    () => connections.filter((c) => c.capabilities?.pushRequests),
    [connections],
  );
  const threadClosed = request?.status === 'COMPLETED' || request?.status === 'CANCELLED';

  function openBooking() {
    if (!request) return;
    prefillBookingFromConsultation({
      detail: {
        extracted: session?.extracted,
        diagnosis: diagnosis || undefined,
      } as ConsultationDetail,
      serviceRequestId: request.id,
      fullName: owner,
      phone: phone || undefined,
    });
    void navigate('/booking');
  }

  async function changeStatus(status: ServiceRequestStatus) {
    if (!request) return;
    setActionError(null);
    const previousStatus = request.status;
    try {
      const updated = await patchServiceRequestStatus(request.id, status, request.version);
      setRequest({ ...request, status: updated.status, version: updated.version });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const fresh = await getServiceRequest(request.id);
        setRequest(fresh);
        setActionError(
          `Конфликт версий: вы меняли статус на «${SERVICE_REQUEST_STATUS_LABELS[status]}», в системе сейчас «${SERVICE_REQUEST_STATUS_LABELS[fresh.status]}» (v${fresh.version}, было v${request.version} / «${SERVICE_REQUEST_STATUS_LABELS[previousStatus]}»).`,
        );
        return;
      }
      setActionError(
        e instanceof Error ? e.message : 'Не удалось изменить статус',
      );
      await load();
    }
  }

  async function submitReply() {
    if (!request || (!reply.trim() && !pendingAttachments.length)) return;
    setSending(true);
    setActionError(null);
    try {
      const msg = await sendRequestMessage(request.id, {
        body: reply.trim(),
        attachments: pendingAttachments.map(({ fileName, mimeType, contentBase64 }) => ({
          fileName,
          mimeType,
          contentBase64,
        })),
      });
      setMessages((prev) => [...prev, msg]);
      setReply('');
      setPendingAttachments([]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  async function handleAssignManager() {
    if (!request || !assignManagerId) return;
    setActionError(null);
    try {
      const updated = await assignRequestToManager(request.id, assignManagerId);
      setRequest({
        ...request,
        assignedManagerId: updated.assignedManagerId,
        assignedManager: updated.assignedManager || request.assignedManager,
        version: updated.version,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось назначить менеджера');
    }
  }

  async function handleExport() {
    if (!request || !exportConnectionId) return;
    setActionError(null);
    try {
      const out = await exportRequestToCrm(request.id, exportConnectionId);
      setIntegrations(out);
      setExportOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось передать заявку');
    }
  }

  async function handleRetry(connectionId: string) {
    if (!request) return;
    setActionError(null);
    try {
      const out = await retryRequestIntegration(request.id, connectionId);
      setIntegrations(out);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Повтор не удался');
    }
  }

  if (loading) return <Loader />;
  if (error || !request) return <ErrorState message={error || 'Заявка не найдена'} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page request-detail-page">
      <PageHeader
        title={`Заявка №${formatRequestNumber(request.id)}`}
        breadcrumbs={[
          { label: 'Рабочий стол', to: '/dashboard/manager' },
          { label: 'Очередь', to: '/dashboard/manager/requests' },
          { label: `№${formatRequestNumber(request.id)}` },
        ]}
        actions={
          <div className="request-detail-actions">
            {phone ? (
              <>
                <a href={`tel:${phone}`} className="btn btn-ghost">
                  <Phone size={16} aria-hidden />
                  Позвонить
                </a>
                <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(phone)}>
                  Скопировать телефон
                </Button>
              </>
            ) : null}
            <Button variant="secondary" onClick={() => openBooking()}>
              Назначить запись
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void assignRequestToMe(request.id).then(() => void load());
              }}
            >
              Назначить на себя
            </Button>
            <div className="manager-assign-row">
              <ManagerPicker
                value={assignManagerId || request.assignedManagerId || ''}
                onChange={setAssignManagerId}
                allowEmpty
                placeholder="Менеджер"
              />
              <Button
                variant="ghost"
                disabled={!assignManagerId}
                onClick={() => void handleAssignManager()}
              >
                Назначить
              </Button>
            </div>
            {exportableConnections.length ? (
              <Button
                onClick={() => {
                  setExportConnectionId(exportableConnections.length === 1 ? exportableConnections[0].id : '');
                  setExportOpen(true);
                }}
              >
                Передать в учётную систему
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="request-summary-bar request-summary-bar-sticky">
        <div className="request-summary-grid">
          <div>
            <span className="label">Статус</span>
            <StatusBadge status={request.status} />
          </div>
          <div>
            <span className="label">Клиент</span>
            <strong>{owner}</strong>
          </div>
          <div>
            <span className="label">Автомобиль</span>
            <strong>{car}</strong>
          </div>
          <div>
            <span className="label">ИИ</span>
            <div className="request-ai-badges">
              {urgency ? <UrgencyBadge urgency={urgency} /> : <span className="muted">—</span>}
              {confidence != null ? <span className="ai-confidence-pill">{confidence}%</span> : null}
            </div>
          </div>
          <div>
            <span className="label">Дата</span>
            <strong>{new Date(request.createdAt).toLocaleString('ru-RU')}</strong>
          </div>
          <div>
            <span className="label">Изменить статус</span>
            <RequestStatusSelector value={request.status} onChange={(s) => void changeStatus(s)} />
          </div>
        </div>
      </Card>

      {actionError ? <div className="alert alert-error">{actionError}</div> : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'summary', label: 'Сводка' },
          { id: 'consultation', label: 'Диалог ИИ' },
          { id: 'messages', label: 'Переписка' },
          { id: 'works', label: 'Работы и оценка' },
          { id: 'history', label: 'История и CRM' },
        ]}
      />

      {tab === 'summary' && (
        <Card>
          <RequestSummaryPanel
            request={request}
            integrations={integrations}
            onFeedbackSaved={(feedback) =>
              setRequest((prev) =>
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
        </Card>
      )}

      {tab === 'consultation' && (
        <Card className="consultation-thread">
          <ConsultationStagesTimeline
            progressPercent={session?.progressPercent}
            hasDiagnosis={Boolean(diagnosis)}
            messageCount={session?.messages?.length ?? 0}
          />
          <ConsultationPhotoGallery
            photoObservations={session?.flowState?.photo_observations}
            messageContents={(session?.messages || []).map((m) => m.content)}
          />
          {session?.messages?.length ? (
            session.messages.map((m) =>
              m.sender === 'ASSISTANT' || m.sender === 'assistant' ? (
                <AssistantMessage key={m.id} message={m} />
              ) : (
                <UserMessage key={m.id} message={m} />
              ),
            )
          ) : (
            <EmptyState title="Диалог пуст" description="Сообщения консультации не сохранены." />
          )}
        </Card>
      )}

      {tab === 'messages' && (
        <FollowUpChatPanel
          messages={messages}
          value={reply}
          onChange={setReply}
          onSubmit={submitReply}
          disabled={threadClosed}
          sending={sending}
          error={null}
          placeholder="Ответ клиенту..."
          attachments={pendingAttachments}
          onAttachmentsChange={setPendingAttachments}
          templates={threadClosed ? undefined : MESSAGE_TEMPLATES.map((tpl) => ({ id: tpl.id, label: tpl.label, body: tpl.body }))}
          closedMessage={threadClosed ? 'Переписка закрыта — заявка завершена или отменена.' : undefined}
          viewerRole="MANAGER"
          emptyTitle="Сообщений пока нет"
          emptyDescription="Напишите клиенту первое сообщение."
        />
      )}

      {tab === 'works' && (
        <div className="stack">
          <Card>
            <ConsultationFeedbackPanel
              requestId={request.id}
              initial={session?.feedback}
              onSaved={(feedback) =>
                setRequest((prev) =>
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
          </Card>
          <Card>
            <SimilarCasesPanel requestId={request.id} />
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <div className="stack">
          <Card>
            <h2>История</h2>
            <ul className="activity-timeline">
              <li>
                <time>{new Date(request.createdAt).toLocaleString('ru-RU')}</time>
                <span>Заявка создана</span>
              </li>
              {statusHistory.map((row) => (
                <li key={row.id}>
                  <time>{new Date(row.createdAt).toLocaleString('ru-RU')}</time>
                  <span>
                    Статус: {row.fromStatus ? SERVICE_REQUEST_STATUS_LABELS[row.fromStatus as ServiceRequestStatus] || row.fromStatus : '—'} →{' '}
                    {SERVICE_REQUEST_STATUS_LABELS[row.toStatus as ServiceRequestStatus] || row.toStatus}
                    {row.actor?.fullName ? ` (${row.actor.fullName})` : ''}
                  </span>
                </li>
              ))}
              {messages.map((m) => (
                <li key={m.id}>
                  <time>{new Date(m.createdAt).toLocaleString('ru-RU')}</time>
                  <span>Отправлено сообщение менеджером</span>
                </li>
              ))}
              {session?.feedback ? (
                <li>
                  <time>{new Date(session.feedback.updatedAt).toLocaleString('ru-RU')}</time>
                  <span>Оценка диагноза ИИ сохранена</span>
                </li>
              ) : null}
              {integrations?.jobs
                ?.filter((j) => j.status === 'SUCCEEDED')
                .map((j) => (
                  <li key={j.id}>
                    <time>{new Date(j.updatedAt).toLocaleString('ru-RU')}</time>
                    <span>Заявка передана в учётную систему</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <h2>Синхронизация с учётной системой</h2>
            {!connections.length ? (
              <EmptyState
                title="Нет активных подключений"
                description="Администратор может подключить CRM в разделе интеграций."
              />
            ) : null}
            {integrations?.links?.length ? (
              <ul className="integration-links">
                {integrations.links.map((link) => (
                  <li key={link.connectionId}>
                    <strong>{link.connectionName}</strong>
                    <span>{INTEGRATION_PROVIDER_LABELS[link.provider]}</span>
                    <span>Внешний номер: {link.externalEntityId}</span>
                    {link.externalUrl ? (
                      <a href={link.externalUrl} target="_blank" rel="noreferrer">
                        Открыть во внешней системе
                      </a>
                    ) : null}
                    <small>Синхронизировано: {new Date(link.synchronizedAt).toLocaleString('ru-RU')}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Заявка ещё не передана во внешнюю систему.</p>
            )}
            {integrations?.jobs?.length ? (
              <div className="integration-jobs">
                <h3>Последние попытки</h3>
                <ul>
                  {integrations.jobs.map((job) => (
                    <li key={job.id}>
                      <IntegrationStatusBadge status={job.status} />
                      <span>{INTEGRATION_JOB_STATUS_LABELS[job.status] || job.status}</span>
                      {job.lastErrorMessage ? <span className="danger">{job.lastErrorMessage}</span> : null}
                      {['FAILED', 'RETRYING', 'DEAD_LETTER'].includes(job.status) ? (
                        <Button variant="ghost" onClick={() => void handleRetry(job.connectionId)}>
                          Повторить
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={exportOpen}
        title="Передать в учётную систему"
        text={
          exportableConnections.length === 1
            ? `Передать заявку клиента ${owner} (${car}) в «${exportableConnections[0].name}»?`
            : 'Выберите подключение и подтвердите передачу заявки.'
        }
        onConfirm={() => void handleExport()}
        onCancel={() => setExportOpen(false)}
      />
      {exportOpen && exportableConnections.length > 1 ? (
        <div className="export-connection-picker">
          <label>
            Подключение
            <select value={exportConnectionId} onChange={(e) => setExportConnectionId(e.target.value)}>
              <option value="">Выберите систему</option>
              {exportableConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
