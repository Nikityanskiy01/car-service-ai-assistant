import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import {
  getServiceRequest,
  listBookings,
  listRequestMessages,
  sendRequestMessage,
  type FollowUpMessage,
} from '../../../api/dashboard';
import { CaseTimeline } from '../../../components/client/CaseTimeline';
import { MessageAttachmentInput, type PendingAttachment } from '../../../components/requests/MessageAttachmentInput';
import { MessageAttachmentList } from '../../../components/requests/MessageAttachmentList';
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
import { Textarea } from '../../../components/ui/Textarea';
import { buildClientCases, parseClientCaseDetailTab } from '../../../features/client-cases/buildClientCases';
import type { BookingCaseInput, ClientCase, ClientCaseDetailTab } from '../../../features/client-cases/types';
import { prefillBookingFromConsultation } from '../../../features/services/prefill';
import { clientBookingStatusLabel, clientRequestStatusLabel } from '../../../lib/clientStatusLabels';
import { CLIENT_MESSAGE_TEMPLATES } from '../../../lib/clientMessageTemplates';
import { formatRequestNumber } from '../../../lib/labels';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ConsultationDetail } from '../../../types/consultation';
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

function formatBookingDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientCaseDetailPage() {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseClientCaseDetailTab(searchParams.get('tab'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequestDetail | null>(null);
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [clientCase, setClientCase] = useState<ClientCase | null>(null);
  const [bookingPreferredAt, setBookingPreferredAt] = useState<string | undefined>();
  const [bookingId, setBookingId] = useState<string | undefined>();
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [reply, setReply] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  usePageMeta({
    title: 'Обращение',
    description: 'Ход дела, диагностика, переписка и запись.',
  });

  async function load() {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      try {
        const [req, msgs, bookings] = await Promise.all([
          getServiceRequest(caseId),
          listRequestMessages(caseId).catch(() => []),
          listBookings(),
        ]);
        const booking = (bookings as BookingCaseInput[]).find((b) => b.serviceRequest?.id === req.id);
        const built = buildClientCases([], [req], bookings as BookingCaseInput[])[0] ?? null;
        setRequest(req);
        setConsultation(null);
        setClientCase(built);
        setBookingPreferredAt(booking?.preferredAt);
        setBookingId(booking?.id);
        setMessages(msgs);
        return;
      } catch {
        // not a service request id — try consultation draft
      }

      const detail = await api<ConsultationDetail>(`/consultations/${caseId}`);
      const createdAt = detail.messages?.[0]?.createdAt || new Date().toISOString();
      const built =
        buildClientCases(
          [
            {
              id: detail.id,
              status: detail.status,
              createdAt,
              progressPercent: detail.progressPercent,
              make: detail.extracted?.make,
              model: detail.extracted?.model,
              symptoms: detail.extracted?.symptoms,
              extracted: detail.extracted,
            },
          ],
          [],
          [],
        )[0] ?? null;
      setRequest(null);
      setConsultation(detail);
      setClientCase(built);
      setBookingPreferredAt(undefined);
      setBookingId(undefined);
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить обращение');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [caseId]);

  const isDraft = !request && !!consultation;
  const isClosed =
    request?.status === 'COMPLETED' ||
    request?.status === 'CANCELLED';

  const car = useMemo(() => {
    if (request) {
      return `${request.snapshotMake || ''} ${request.snapshotModel || ''}`.trim() || 'Авто не указано';
    }
    const extracted = consultation?.extracted;
    return [extracted?.make, extracted?.model].filter(Boolean).join(' ') || 'Диагностика';
  }, [consultation, request]);

  const symptoms = request?.snapshotSymptoms || consultation?.extracted?.symptoms || '—';

  const recommendation = request?.consultationSession?.recommendations?.[0];
  const diagnosis =
    request?.consultationSession?.diagnosis ||
    consultation?.diagnosis ||
    (request?.consultationSession?.flowState as { diagnosis?: ConsultationDiagnosisSnapshot } | undefined)
      ?.diagnosis ||
    null;

  function setTab(next: ClientCaseDetailTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  function continueConsultation() {
    if (!consultation?.id && !request?.consultationSessionId) return;
    const sessionId = consultation?.id || request?.consultationSessionId;
    if (sessionId) {
      sessionStorage.setItem(STORAGE_KEYS.consultSessionId, sessionId);
    }
    navigate('/consult');
  }

  function goToBooking() {
    if (request) {
      prefillBookingFromConsultation({
        detail: consultation,
        serviceRequestId: request.id,
      });
    }
    navigate('/booking');
  }

  async function handleSend() {
    if ((!reply.trim() && !pendingAttachments.length) || !request?.id) return;
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

  if (loading) return <Loader label="Загружаем обращение..." />;
  if (error || !clientCase) return <ErrorState message={error || 'Обращение не найдено'} />;

  const title = request
    ? `Обращение №${formatRequestNumber(request.id)}`
    : 'Черновик диагностики';

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={title}
        description={car}
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Обращения', to: '/dashboard/client/cases' },
          { label: request ? `№${formatRequestNumber(request.id)}` : 'Черновик' },
        ]}
        actions={
          request ? (
            <a className="btn btn-secondary" href={`/api/service-requests/${request.id}/export.pdf`} download>
              Скачать PDF
            </a>
          ) : null
        }
      />

      {request ? <StatusPipeline current={request.status} /> : null}

      <Tabs
        value={tab}
        onChange={(id) => setTab(id as ClientCaseDetailTab)}
        items={[
          { id: 'progress', label: 'Ход дела' },
          { id: 'diagnosis', label: 'Диагностика' },
          { id: 'messages', label: `Переписка (${messages.length})` },
          { id: 'booking', label: 'Записаться' },
        ]}
      />

      {tab === 'progress' ? (
        <div className="grid two">
          <Card>
            <h2>Что происходит</h2>
            <CaseTimeline
              clientCase={clientCase}
              requestCreatedAt={request?.createdAt}
              bookingPreferredAt={bookingPreferredAt}
            />
          </Card>
          <Card>
            <h2>Детали</h2>
            <dl className="detail-dl desk-profile-dl">
              {request ? (
                <div>
                  <dt>Статус</dt>
                  <dd>
                    <StatusBadge status={request.status} />
                    <span className="muted-text"> {clientRequestStatusLabel(request.status)}</span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Автомобиль</dt>
                <dd>{car}</dd>
              </div>
              <div>
                <dt>Симптомы</dt>
                <dd>{symptoms}</dd>
              </div>
              {request ? (
                <div>
                  <dt>Создана</dt>
                  <dd>{formatDate(request.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="row gap-sm case-detail-actions">
              {isDraft ? (
                <Button onClick={continueConsultation}>Продолжить диагностику</Button>
              ) : (
                <Button variant="secondary" onClick={() => setTab('messages')}>
                  Написать менеджеру
                </Button>
              )}
              <Button variant="ghost" onClick={goToBooking}>
                Записаться
              </Button>
            </div>
          </Card>
        </div>
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
                  : consultation?.recommendations?.map((item) => ({
                      summary: item.summary,
                      confidence: item.confidence,
                      urgency: item.urgency,
                      costFromMinor: item.costFromMinor,
                    })) || []
              }
              diagnosis={diagnosis}
              fallbackCost={recommendation?.estimatedPriceFrom ?? consultation?.costFromMinor ?? undefined}
              fallbackConfidence={recommendation?.confidence ?? consultation?.confidencePercent ?? undefined}
            />
          ) : (
            <EmptyState
              title="Диагностика недоступна"
              description={
                isDraft
                  ? 'Продолжите диалог в чате, чтобы получить предварительный анализ.'
                  : 'К этому обращению не привязана консультация.'
              }
              action={
                isDraft ? (
                  <Button variant="secondary" onClick={continueConsultation}>
                    Продолжить диагностику
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
      ) : null}

      {tab === 'messages' ? (
        <Card>
          <h2>Переписка с менеджером</h2>
          {!request ? (
            <EmptyState
              title="Переписка появится после заявки"
              description="Завершите диагностику и создайте заявку — менеджер ответит здесь."
              action={
                <Button variant="secondary" onClick={continueConsultation}>
                  Продолжить диагностику
                </Button>
              }
            />
          ) : messages.length === 0 ? (
            <EmptyState title="Сообщений пока нет" description="Задайте вопрос — менеджер ответит здесь." />
          ) : (
            <ul className="message-thread message-thread-bubbles">
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  className={`message-bubble ${msg.author?.role === 'CLIENT' ? 'is-client' : 'is-staff'}`}
                >
                  <div className="message-thread-meta">
                    <strong>{msg.author?.role === 'CLIENT' ? 'Вы' : msg.author?.fullName || 'Менеджер'}</strong>
                    <time>{formatDate(msg.createdAt)}</time>
                  </div>
                  <p>{msg.body || null}</p>
                  <MessageAttachmentList attachments={msg.attachments} />
                </li>
              ))}
            </ul>
          )}
          {request ? (
            <div className="message-compose">
              {!isClosed ? (
                <div className="message-template-chips" aria-label="Быстрые вопросы">
                  {CLIENT_MESSAGE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="message-template-chip"
                      onClick={() => setReply(template.body)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Ваш вопрос или уточнение..."
                rows={3}
                disabled={isClosed}
              />
              {isClosed ? (
                <p className="muted-text">Обращение закрыто — новые сообщения недоступны.</p>
              ) : null}
              {actionError ? <p className="form-error">{actionError}</p> : null}
              <MessageAttachmentInput
                files={pendingAttachments}
                onChange={setPendingAttachments}
                disabled={sending || isClosed}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={sending || (!reply.trim() && !pendingAttachments.length) || isClosed}
              >
                {sending ? 'Отправка...' : 'Отправить'}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === 'booking' ? (
        <Card>
          <h2>Запись на визит</h2>
          {bookingPreferredAt ? (
            <div className="stack">
              <p>
                <strong>{formatBookingDate(bookingPreferredAt)}</strong>
              </p>
              <p className="muted-text">{clientBookingStatusLabel('CONFIRMED')}</p>
              {bookingId ? (
                <Link className="btn btn-secondary btn-sm" to={`/dashboard/client/bookings/${bookingId}`}>
                  Детали записи
                </Link>
              ) : (
                <Link className="btn btn-secondary btn-sm" to="/dashboard/client/bookings">
                  Все записи
                </Link>
              )}
            </div>
          ) : (
            <EmptyState
              title="Запись ещё не назначена"
              description="Выберите удобное время визита в сервис."
              action={
                <Button variant="secondary" onClick={goToBooking}>
                  Записаться
                </Button>
              }
            />
          )}
        </Card>
      ) : null}

      <div className="case-detail-sticky-actions">
        {!isDraft ? (
          <Button variant="secondary" onClick={() => setTab('messages')}>
            Написать
          </Button>
        ) : (
          <Button onClick={continueConsultation}>Продолжить</Button>
        )}
        <Button variant="ghost" onClick={goToBooking}>
          Записаться
        </Button>
      </div>
    </div>
  );
}
