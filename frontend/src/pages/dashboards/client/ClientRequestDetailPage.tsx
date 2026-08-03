import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getServiceRequest, listRequestMessages, sendRequestMessage } from '../../../api/dashboard';
import { DiagnosticSummary } from '../../../components/consultation/DiagnosticSummary';
import { StatusPipeline } from '../../../components/dashboard/StatusPipeline';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Tabs } from '../../../components/ui/Tabs';
import { FollowUpChatPanel } from '../../../components/messages/FollowUpChatPanel';
import { formatRequestNumber } from '../../../lib/labels';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { FollowUpMessage } from '../../../api/dashboard';
import type { ConsultationDiagnosisSnapshot } from '../../../types/consultation';
import type { ServiceRequestDetail } from '../../../types/serviceRequest';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientRequestDetailPage() {
  const { requestId = '' } = useParams();
  usePageMeta({ title: 'Заявка', description: 'Детали обращения и переписка с менеджером.' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [tab, setTab] = useState('overview');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const [req, msgs] = await Promise.all([
        getServiceRequest(requestId),
        listRequestMessages(requestId).catch(() => []),
      ]);
      setRequest(req);
      setMessages(msgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заявку');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [requestId]);

  async function handleSend() {
    if (!reply.trim() || !requestId) return;
    setSending(true);
    setActionError(null);
    try {
      const msg = await sendRequestMessage(requestId, { body: reply.trim() });
      setMessages((prev) => [...prev, msg]);
      setReply('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loader label="Загружаем заявку..." />;
  if (error || !request) return <ErrorState message={error || 'Заявка не найдена'} />;

  const car = `${request.snapshotMake || ''} ${request.snapshotModel || ''}`.trim() || 'Авто не указано';
  const recommendation = request.consultationSession?.recommendations?.[0];
  const diagnosis =
    request.consultationSession &&
    'diagnosis' in request.consultationSession &&
    request.consultationSession.diagnosis
      ? (request.consultationSession.diagnosis as ConsultationDiagnosisSnapshot)
      : null;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={`Заявка №${formatRequestNumber(request.id)}`}
        description={car}
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Заявки', to: '/dashboard/client/requests' },
          { label: `№${formatRequestNumber(request.id)}` },
        ]}
        actions={
          <a className="btn btn-secondary" href={`/api/service-requests/${request.id}/export.pdf`} download>
            Скачать PDF
          </a>
        }
      />

      <StatusPipeline current={request.status} />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'messages', label: `Переписка (${messages.length})` },
          { id: 'diagnosis', label: 'Диагностика' },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid two">
          <Card>
            <h2>Детали</h2>
            <dl className="detail-dl desk-profile-dl">
              <div>
                <dt>Статус</dt>
                <dd>
                  <StatusBadge status={request.status} />
                </dd>
              </div>
              <div>
                <dt>Автомобиль</dt>
                <dd>{car}</dd>
              </div>
              <div>
                <dt>Симптомы</dt>
                <dd>{request.snapshotSymptoms || '—'}</dd>
              </div>
              <div>
                <dt>Создана</dt>
                <dd>{formatDate(request.createdAt)}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2>Что дальше</h2>
            <p className="muted-text">
              Менеджер обработает заявку и свяжется с вами. Вы можете написать вопрос во вкладке «Переписка».
            </p>
            <div className="row gap-sm" style={{ marginTop: '1rem' }}>
              <Button variant="secondary" onClick={() => setTab('messages')}>
                Написать менеджеру
              </Button>
              <Link className="btn btn-ghost" to="/booking">
                Записаться
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'messages' ? (
        <FollowUpChatPanel
          messages={messages}
          value={reply}
          onChange={setReply}
          onSubmit={handleSend}
          sending={sending}
          error={actionError}
          placeholder="Ваш вопрос или уточнение..."
          viewerRole="CLIENT"
          emptyTitle="Сообщений пока нет"
          emptyDescription="Задайте вопрос — менеджер ответит здесь."
        />
      ) : null}

      {tab === 'diagnosis' ? (
        <Card>
          <h2>Результат ИИ-диагностики</h2>
          {recommendation || diagnosis ? (
            <DiagnosticSummary
              recommendations={
                recommendation
                  ? [
                      {
                        summary: recommendation.summary ?? undefined,
                        confidence: recommendation.confidence ?? undefined,
                        urgency: recommendation.urgency ?? undefined,
                        costFromMinor: recommendation.estimatedPriceFrom ?? undefined,
                      },
                    ]
                  : []
              }
              diagnosis={diagnosis}
              fallbackCost={recommendation?.estimatedPriceFrom}
              fallbackConfidence={recommendation?.confidence}
            />
          ) : (
            <EmptyState title="Диагностика недоступна" description="К этой заявке не привязана консультация." />
          )}
        </Card>
      ) : null}
    </div>
  );
}
