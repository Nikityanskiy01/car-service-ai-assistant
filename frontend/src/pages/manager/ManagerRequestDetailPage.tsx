import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  exportRequestToCrm,
  getRequestIntegrations,
  listIntegrations,
  retryRequestIntegration,
} from '../../api/integrations';
import {
  getServiceRequest,
  listRequestMessages,
  patchServiceRequestStatus,
  sendRequestMessage,
} from '../../api/dashboard';
import { AssistantMessage } from '../../components/consultation/AssistantMessage';
import { DiagnosticSummary } from '../../components/consultation/DiagnosticSummary';
import { UserMessage } from '../../components/consultation/UserMessage';
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
import { Textarea } from '../../components/ui/Textarea';
import {
  formatRequestNumber,
  INTEGRATION_JOB_STATUS_LABELS,
  INTEGRATION_PROVIDER_LABELS,
} from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { RequestIntegrationStatus } from '../../types/integration';
import type { IntegrationConnection } from '../../types/integration';
import type { ServiceRequestDetail, ServiceRequestStatus } from '../../types/serviceRequest';
import type { FollowUpMessage } from '../../api/dashboard';

export function ManagerRequestDetailPage() {
  const { requestId = '' } = useParams();
  usePageMeta({ title: 'Заявка', description: 'Подробная карточка обращения.' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [integrations, setIntegrations] = useState<RequestIntegrationStatus | null>(null);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [tab, setTab] = useState('overview');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportConnectionId, setExportConnectionId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

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
    void listIntegrations()
      .then((rows) => setConnections(rows.filter((c) => c.enabled)))
      .catch(() => setConnections([]));
  }, []);

  const owner = request?.client?.fullName || request?.guestName || 'Гость';
  const phone = request?.client?.phone || request?.guestPhone || '';
  const car = `${request?.snapshotMake || ''} ${request?.snapshotModel || ''}`.trim() || 'Не указан';
  const recommendation = request?.consultationSession?.recommendations?.[0];

  const exportableConnections = useMemo(
    () => connections.filter((c) => c.capabilities?.pushRequests),
    [connections],
  );

  async function changeStatus(status: ServiceRequestStatus) {
    if (!request) return;
    setActionError(null);
    try {
      const updated = await patchServiceRequestStatus(request.id, status, request.version);
      setRequest({ ...request, status: updated.status, version: updated.version });
    } catch (e) {
      setActionError(
        e instanceof Error && e.message.includes('409')
          ? 'Заявка была изменена другим сотрудником. Обновите данные и повторите.'
          : e instanceof Error
            ? e.message
            : 'Не удалось изменить статус',
      );
      await load();
    }
  }

  async function submitReply() {
    if (!request || !reply.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      const msg = await sendRequestMessage(request.id, reply.trim());
      setMessages((prev) => [...prev, msg]);
      setReply('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
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
          { label: 'Заявки', to: '/dashboard/manager/requests' },
          { label: `№${formatRequestNumber(request.id)}` },
        ]}
        actions={
          <div className="request-detail-actions">
            {phone ? (
              <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(phone)}>
                Скопировать телефон
              </Button>
            ) : null}
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
            <Link to="/booking">
              <Button variant="secondary">Назначить визит</Button>
            </Link>
          </div>
        }
      />

      <Card className="request-summary-bar">
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
            <span className="label">Дата</span>
            <strong>{new Date(request.createdAt).toLocaleString('ru-RU')}</strong>
          </div>
          <div>
            <span className="label">Изменить статус</span>
            <RequestStatusSelector value={request.status} onChange={(s) => void changeStatus(s)} />
          </div>
        </div>
      </Card>

      {actionError ? <div className="alert alert-danger">{actionError}</div> : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'consultation', label: 'Консультация' },
          { id: 'analysis', label: 'Результат анализа' },
          { id: 'messages', label: 'Общение' },
          { id: 'integration', label: 'Учётная система' },
          { id: 'history', label: 'История' },
        ]}
      />

      {tab === 'overview' && (
        <Card>
          <h2>Проблема и собранные данные</h2>
          <p>{request.snapshotSymptoms || 'Симптомы не указаны'}</p>
          {request.consultationSession?.extracted ? (
            <dl className="detail-dl">
              {Object.entries(request.consultationSession.extracted)
                .filter(([, v]) => v != null && v !== '')
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {recommendation?.summary ? (
            <p>
              <strong>Рекомендация ИИ:</strong> {recommendation.summary}
            </p>
          ) : null}
        </Card>
      )}

      {tab === 'consultation' && (
        <Card className="consultation-thread">
          {request.consultationSession?.messages?.length ? (
            request.consultationSession.messages.map((m) =>
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

      {tab === 'analysis' && (
        <Card>
          {recommendation ? (
            <DiagnosticSummary
              recommendations={[
                {
                  summary: recommendation.summary || undefined,
                  confidence: recommendation.confidence ?? undefined,
                  urgency: (recommendation.urgency as string) || undefined,
                  checks: Array.isArray(recommendation.recommendedChecks)
                    ? (recommendation.recommendedChecks as string[])
                    : [],
                  costFromMinor: recommendation.estimatedPriceFrom ?? undefined,
                },
              ]}
            />
          ) : (
            <EmptyState title="Анализ не завершён" description="ИИ-анализ ещё не готов или требует уточнений." />
          )}
        </Card>
      )}

      {tab === 'messages' && (
        <Card>
          <div className="message-thread">
            {messages.length ? (
              messages.map((m) => (
                <article key={m.id} className="follow-up-message">
                  <header>
                    <strong>{m.author?.fullName || 'Менеджер'}</strong>
                    <time>{new Date(m.createdAt).toLocaleString('ru-RU')}</time>
                  </header>
                  <p>{m.body}</p>
                </article>
              ))
            ) : (
              <EmptyState title="Сообщений пока нет" description="Напишите клиенту первое сообщение." />
            )}
          </div>
          <div className="message-compose">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ответ клиенту…"
              rows={3}
            />
            <Button disabled={sending || !reply.trim()} onClick={() => void submitReply()}>
              Отправить
            </Button>
          </div>
        </Card>
      )}

      {tab === 'integration' && (
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
      )}

      {tab === 'history' && (
        <Card>
          <ul className="activity-timeline">
            <li>
              <time>{new Date(request.createdAt).toLocaleString('ru-RU')}</time>
              <span>Заявка создана</span>
            </li>
            {messages.map((m) => (
              <li key={m.id}>
                <time>{new Date(m.createdAt).toLocaleString('ru-RU')}</time>
                <span>Отправлено сообщение менеджером</span>
              </li>
            ))}
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
            <select
              value={exportConnectionId}
              onChange={(e) => setExportConnectionId(e.target.value)}
            >
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
