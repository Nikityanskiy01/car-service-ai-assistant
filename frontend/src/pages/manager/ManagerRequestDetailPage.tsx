import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Phone, RefreshCw, Send, UserCheck } from 'lucide-react';
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
import { RequestCompletionDocumentsPanel } from '../../components/requests/RequestCompletionDocumentsPanel';
import { RequestSummaryPanel } from '../../components/requests/RequestSummaryPanel';
import { SimilarCasesPanel } from '../../components/requests/SimilarCasesPanel';
import { UserMessage } from '../../components/consultation/UserMessage';
import { ManagerPicker } from '../../components/manager/ManagerPicker';
import { FollowUpChatPanel } from '../../components/messages/FollowUpChatPanel';
import type { PendingAttachment } from '../../components/requests/MessageAttachmentInput';
import { RequestStatusSelector } from '../../components/requests/RequestStatusSelector';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CopyPhoneButton } from '../../components/ui/CopyPhoneButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
import { Loader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/toastContext';
import { UrgencyBadge } from '../../components/consultation/UrgencyBadge';
import { managerZonePaths } from '../../config/managerPaths';
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

type ManagerRequestDetailPageProps = {
  adminZone?: boolean;
};

const TABS = [
  { id: 'summary', label: 'Сводка' },
  { id: 'consultation', label: 'Диалог ИИ' },
  { id: 'messages', label: 'Переписка' },
  { id: 'works', label: 'Работы и оценка' },
  { id: 'history', label: 'История и CRM' },
];

export function ManagerRequestDetailPage({ adminZone = false }: ManagerRequestDetailPageProps) {
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  const paths = managerZonePaths(adminZone);
  const { success, error: toastError } = useToast();
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
  const [assigning, setAssigning] = useState(false);
  const [sending, setSending] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportConnectionId, setExportConnectionId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!requestId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [detail, msgs, integ] = await Promise.all([
        getServiceRequest(requestId),
        listRequestMessages(requestId).catch(() => []),
        getRequestIntegrations(requestId).catch(() => ({ links: [], jobs: [] })),
      ]);
      setRequest(detail);
      setMessages(msgs);
      setIntegrations(integ);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listManagerIntegrations()
      .then((rows) =>
        setConnections(
          rows.map((connection) => ({
            ...connection,
            capabilities: connection.capabilities || { pushRequests: true },
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
    () => connections.filter((connection) => connection.capabilities?.pushRequests),
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
      success(`Статус: ${SERVICE_REQUEST_STATUS_LABELS[updated.status]}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const fresh = await getServiceRequest(request.id);
        setRequest(fresh);
        setActionError(
          `Заявку уже изменил другой сотрудник. Вы выбирали «${SERVICE_REQUEST_STATUS_LABELS[status]}», сейчас в системе «${SERVICE_REQUEST_STATUS_LABELS[fresh.status]}» (было «${SERVICE_REQUEST_STATUS_LABELS[previousStatus]}»). Проверьте и повторите.`,
        );
        toastError('Конфликт версий: данные обновлены');
        return;
      }
      const message = e instanceof Error ? e.message : 'Не удалось изменить статус';
      setActionError(message);
      toastError(message);
      await load(true);
    }
  }

  async function submitReply() {
    if (!request || (!reply.trim() && !pendingAttachments.length)) return;
    setSending(true);
    setActionError(null);
    try {
      const message = await sendRequestMessage(request.id, {
        body: reply.trim(),
        attachments: pendingAttachments.map(({ fileName, mimeType, contentBase64 }) => ({
          fileName,
          mimeType,
          contentBase64,
        })),
      });
      setMessages((prev) => [...prev, message]);
      setReply('');
      setPendingAttachments([]);
      success('Сообщение отправлено клиенту');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось отправить сообщение';
      setActionError(message);
      toastError(message);
    } finally {
      setSending(false);
    }
  }

  async function handleAssignToMe() {
    if (!request) return;
    setAssigning(true);
    setActionError(null);
    try {
      await assignRequestToMe(request.id);
      await load(true);
      success('Заявка назначена на вас');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось назначить заявку';
      setActionError(message);
      toastError(message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleAssignManager() {
    if (!request || !assignManagerId) return;
    setAssigning(true);
    setActionError(null);
    try {
      const updated = await assignRequestToManager(request.id, assignManagerId);
      setRequest({
        ...request,
        assignedManagerId: updated.assignedManagerId,
        assignedManager: updated.assignedManager || request.assignedManager,
        version: updated.version,
      });
      setAssignManagerId('');
      success(`Ответственный: ${updated.assignedManager?.fullName || 'обновлён'}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось назначить менеджера';
      setActionError(message);
      toastError(message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleExport() {
    if (!request || !exportConnectionId) return;
    setExportBusy(true);
    setActionError(null);
    try {
      const out = await exportRequestToCrm(request.id, exportConnectionId);
      setIntegrations(out);
      setExportOpen(false);
      success('Заявка отправлена в учётную систему');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось передать заявку';
      setActionError(message);
      toastError(message);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleRetry(connectionId: string) {
    if (!request) return;
    setActionError(null);
    try {
      const out = await retryRequestIntegration(request.id, connectionId);
      setIntegrations(out);
      success('Повторная отправка поставлена в очередь');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Повтор не удался';
      setActionError(message);
      toastError(message);
    }
  }

  if (loading) return <Loader label="Загружаем заявку…" />;
  if (error || !request) {
    return <ErrorState message={error || 'Заявка не найдена'} onRetry={() => void load()} />;
  }

  const selectedExportConnection = exportableConnections.find(
    (connection) => connection.id === exportConnectionId,
  );

  return (
    <div className="stack dashboard-page request-detail-page">
      <PageHeader
        title={`Заявка №${formatRequestNumber(request.id)}`}
        breadcrumbs={adminZone ? undefined : [
                { label: 'Рабочий стол', to: paths.root },
                { label: 'Очередь', to: paths.requests },
                { label: `№${formatRequestNumber(request.id)}` },
              ]
        }
        actions={
          <div className="request-detail-actions">
            {phone ? (
              <a href={`tel:${phone}`} className="btn btn-secondary">
                <Phone size={16} aria-hidden />
                Позвонить
              </a>
            ) : null}
            <Button variant="ghost" onClick={() => openBooking()}>
              <CalendarPlus size={16} aria-hidden />
              Назначить запись
            </Button>
            {exportableConnections.length ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setExportConnectionId(
                    exportableConnections.length === 1 ? exportableConnections[0].id : '',
                  );
                  setExportOpen(true);
                }}
              >
                <Send size={16} aria-hidden />
                В учётную систему
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => void load()} aria-label="Обновить данные заявки">
              <RefreshCw size={16} aria-hidden />
            </Button>
          </div>
        }
      />

      <Card className="request-summary-bar request-summary-bar-sticky">
        <div className="request-summary-grid">
          <div>
            <span className="label">Статус</span>
            <RequestStatusSelector value={request.status} onChange={(next) => void changeStatus(next)} />
          </div>
          <div>
            <span className="label">Клиент</span>
            <strong>{owner}</strong>
            {phone ? (
              <span className="request-summary-phone">
                <a href={`tel:${phone}`} className="tnum">
                  {phone}
                </a>
                <CopyPhoneButton phone={phone} label="" />
              </span>
            ) : null}
          </div>
          <div>
            <span className="label">Автомобиль</span>
            <strong>{car}</strong>
          </div>
          <div>
            <span className="label">Диагноз ИИ</span>
            <div className="request-ai-badges">
              {urgency ? <UrgencyBadge urgency={urgency} /> : <span className="muted">нет</span>}
              {confidence != null ? <span className="ai-confidence-pill tnum">{confidence}%</span> : null}
            </div>
          </div>
          <div>
            <span className="label">Создана</span>
            <strong className="tnum">{new Date(request.createdAt).toLocaleString('ru-RU')}</strong>
          </div>
          <div className="request-summary-assign">
            <span className="label">Ответственный</span>
            <div className="manager-assign-row">
              <ManagerPicker
                value={assignManagerId || request.assignedManagerId || ''}
                onChange={setAssignManagerId}
                allowEmpty
                placeholder="Не назначен"
                disabled={assigning}
              />
              {assignManagerId && assignManagerId !== request.assignedManagerId ? (
                <Button variant="secondary" disabled={assigning} onClick={() => void handleAssignManager()}>
                  Назначить
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={assigning}
                  onClick={() => void handleAssignToMe()}
                  title="Назначить заявку на себя"
                >
                  <UserCheck size={16} aria-hidden />
                  На себя
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {actionError ? (
        <div className="alert alert-error" role="alert">
          {actionError}
          <button type="button" className="alert-dismiss" onClick={() => setActionError(null)}>
            Скрыть
          </button>
        </div>
      ) : null}

      <Tabs value={tab} onChange={setTab} items={TABS} />

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
            <EmptyState
              title="Диалог пуст"
              description="Клиент пришёл без консультации ИИ либо переписка не сохранилась."
            />
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
          placeholder="Ответ клиенту…"
          attachments={pendingAttachments}
          onAttachmentsChange={setPendingAttachments}
          templates={
            threadClosed
              ? undefined
              : MESSAGE_TEMPLATES.map((template) => ({
                  id: template.id,
                  label: template.label,
                  body: template.body,
                }))
          }
          closedMessage={
            threadClosed ? 'Переписка закрыта: заявка завершена или отменена.' : undefined
          }
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
            <RequestCompletionDocumentsPanel requestId={request.id} requestStatus={request.status} />
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
                <time className="tnum">{new Date(request.createdAt).toLocaleString('ru-RU')}</time>
                <span>Заявка создана</span>
              </li>
              {statusHistory.map((row) => (
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
              {messages.map((message) => (
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
              {integrations?.jobs
                ?.filter((job) => job.status === 'SUCCEEDED')
                .map((job) => (
                  <li key={job.id}>
                    <time className="tnum">{new Date(job.updatedAt).toLocaleString('ru-RU')}</time>
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
            ) : connections.length ? (
              <p className="muted">Заявка ещё не передана во внешнюю систему.</p>
            ) : null}
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

      <Modal
        open={exportOpen}
        title="Передать в учётную систему"
        onClose={() => setExportOpen(false)}
      >
        <p>
          Заявка №{formatRequestNumber(request.id)}, клиент {owner}, {car}.
        </p>
        {exportableConnections.length > 1 ? (
          <label className="stack gap-xs">
            <span>Подключение</span>
            <Select
              value={exportConnectionId}
              onChange={(event) => setExportConnectionId(event.target.value)}
              aria-label="Подключение учётной системы"
            >
              <option value="">Выберите систему</option>
              {exportableConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <p className="muted">Получатель: {exportableConnections[0]?.name}</p>
        )}
        <div className="row gap-sm">
          <Button variant="ghost" onClick={() => setExportOpen(false)}>
            Отмена
          </Button>
          <Button
            disabled={!exportConnectionId || exportBusy}
            onClick={() => void handleExport()}
          >
            {exportBusy ? 'Отправляем…' : `Передать${selectedExportConnection ? ` в ${selectedExportConnection.name}` : ''}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
