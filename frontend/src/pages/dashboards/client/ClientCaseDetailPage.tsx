import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CarFront,
  ClipboardList,
  FileDown,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { api } from '../../../api/client';
import {
  getServiceRequest,
  listBookings,
  listRequestMessages,
  sendRequestMessage,
  type FollowUpMessage,
} from '../../../api/dashboard';
import { CaseNextStep } from '../../../components/client/CaseNextStep';
import { CaseTimeline } from '../../../components/client/CaseTimeline';
import { CaseVisitPanel } from '../../../components/client/CaseVisitPanel';
import { MessageAttachmentInput, type PendingAttachment } from '../../../components/requests/MessageAttachmentInput';
import { MessageAttachmentList } from '../../../components/requests/MessageAttachmentList';
import { DiagnosticSummary } from '../../../components/consultation/DiagnosticSummary';
import { Breadcrumbs } from '../../../components/layout/dashboard/Breadcrumbs';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Textarea } from '../../../components/ui/Textarea';
import { buildClientCases, parseClientCaseDetailTab } from '../../../features/client-cases/buildClientCases';
import {
  resolveCaseNextStep,
  type CaseNextStepActionId,
} from '../../../features/client-cases/resolveCaseNextStep';
import type { BookingCaseInput, ClientCase, ClientCaseDetailTab } from '../../../features/client-cases/types';
import { visitStatusHeadline } from '../../../features/client-cases/visitStatusCopy';
import { prefillBookingFromConsultation } from '../../../features/services/prefill';
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

function truncateTitle(value: string, max = 72) {
  const trimmed = value.trim();
  if (!trimmed) return 'Обращение';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

const DETAIL_TABS: Array<{
  id: ClientCaseDetailTab;
  label: string;
  icon: typeof ClipboardList;
}> = [
  { id: 'progress', label: 'Обзор', icon: ClipboardList },
  { id: 'diagnosis', label: 'Диагностика', icon: Sparkles },
  { id: 'messages', label: 'Сообщения', icon: MessageSquare },
  { id: 'booking', label: 'Визит', icon: CalendarCheck2 },
];

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
  const [bookingStatus, setBookingStatus] = useState<string | undefined>();
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [reply, setReply] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  usePageMeta({
    title: 'Обращение',
    description: 'Обзор, диагностика, сообщения и визит.',
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
        setBookingStatus(booking?.status);
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
      setBookingStatus(undefined);
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
  const isClosed = request?.status === 'COMPLETED' || request?.status === 'CANCELLED';

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

  const nextStep = useMemo(
    () =>
      resolveCaseNextStep({
        isDraft,
        consultationStatus: consultation?.status,
        requestStatus: request?.status,
        requestId: request?.id,
        bookingId,
        bookingPreferredAt,
        bookingStatus,
      }),
    [
      bookingId,
      bookingPreferredAt,
      bookingStatus,
      consultation?.status,
      isDraft,
      request?.id,
      request?.status,
    ],
  );

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

  function handleNextStepAction(action: CaseNextStepActionId) {
    switch (action) {
      case 'continue_diagnosis':
        continueConsultation();
        break;
      case 'book_visit':
        goToBooking();
        break;
      case 'open_visit':
        if (bookingId) {
          navigate(`/dashboard/client/bookings/${bookingId}`);
        } else {
          setTab('booking');
        }
        break;
      case 'write_message':
        setTab('messages');
        break;
      case 'download_pdf':
        if (request?.id) {
          window.location.href = `/api/service-requests/${request.id}/export.pdf`;
        }
        break;
      case 'back_to_list':
        navigate('/dashboard/client/cases');
        break;
      default:
        break;
    }
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

  const title = isDraft
    ? 'Черновик диагностики'
    : truncateTitle(symptoms === '—' ? car : symptoms);

  const requestNumber = request ? `№${formatRequestNumber(request.id)}` : null;

  return (
    <div className="case-detail stack dashboard-page" data-tone={nextStep.tone}>
      <Breadcrumbs
        items={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Обращения', to: '/dashboard/client/cases' },
          { label: requestNumber || 'Черновик' },
        ]}
      />

      <section className="case-detail-hero" aria-labelledby="case-detail-title">
        <div className="case-detail-hero-top">
          <div className="case-detail-hero-copy">
            <p className="case-detail-kicker">
              <CarFront size={14} aria-hidden />
              <span>{car}</span>
              {requestNumber ? <span className="case-detail-kicker-sep">·</span> : null}
              {requestNumber ? <span>{requestNumber}</span> : null}
            </p>
            <h1 id="case-detail-title">{title}</h1>
          </div>
          {request ? (
            <a
              className="case-detail-pdf"
              href={`/api/service-requests/${request.id}/export.pdf`}
              download
            >
              <FileDown size={16} aria-hidden />
              PDF
            </a>
          ) : null}
        </div>

        <CaseNextStep model={nextStep} onAction={handleNextStepAction} />
      </section>

      <div className="case-detail-tabs" role="tablist" aria-label="Разделы обращения">
        {DETAIL_TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.id;
          const count = item.id === 'messages' ? messages.length : null;
          const visitReady = item.id === 'booking' && Boolean(bookingPreferredAt);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${item.id}`}
              className={`case-detail-tab${selected ? ' is-active' : ''}${visitReady ? ' has-signal' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={15} aria-hidden />
              <span>
                {item.label}
                {count != null ? ` (${count})` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'progress' ? (
        <div className="case-detail-panel" role="tabpanel" id="tabpanel-progress" aria-labelledby="tab-progress">
          <div className="case-detail-overview">
            <ul className="case-detail-facts" aria-label="Краткие сведения">
              <li>
                <span>Авто</span>
                <strong>{car}</strong>
              </li>
              <li>
                <span>Симптомы</span>
                <strong>{symptoms}</strong>
              </li>
              {request ? (
                <li>
                  <span>Создано</span>
                  <strong>{formatDate(request.createdAt)}</strong>
                </li>
              ) : null}
            </ul>

            <div className="case-detail-journey">
              <header className="case-detail-section-head">
                <h2>Ход обращения</h2>
                <p className="muted-text">От диагностики до завершения работ</p>
              </header>
              <CaseTimeline
                clientCase={clientCase}
                requestCreatedAt={request?.createdAt}
                bookingPreferredAt={bookingPreferredAt}
                bookingStatus={bookingStatus}
              />
            </div>

            {bookingPreferredAt ? (
              <button
                type="button"
                className="case-detail-visit-teaser"
                data-visit={bookingStatus === 'CONFIRMED' || bookingStatus === 'ARRIVED' ? 'confirmed' : 'requested'}
                onClick={() => setTab('booking')}
              >
                <CalendarCheck2 size={18} aria-hidden />
                <span>
                  <strong>{visitStatusHeadline(bookingStatus, formatDate(bookingPreferredAt))}</strong>
                  <span className="muted-text">
                    {bookingStatus === 'CONFIRMED' || bookingStatus === 'ARRIVED'
                      ? 'Откройте вкладку «Визит» для деталей'
                      : 'Менеджер ещё подтвердит время'}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'diagnosis' ? (
        <div className="case-detail-panel" role="tabpanel" id="tabpanel-diagnosis" aria-labelledby="tab-diagnosis">
          <header className="case-detail-section-head">
            <h2>Результат ИИ-диагностики</h2>
            <p className="muted-text">Предварительный разбор по симптомам</p>
          </header>
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
        </div>
      ) : null}

      {tab === 'messages' ? (
        <div
          className="case-detail-panel case-messages"
          role="tabpanel"
          id="tabpanel-messages"
          aria-labelledby="tab-messages"
        >
          <header className="case-detail-section-head">
            <h2>Сообщения с менеджером</h2>
            <p className="muted-text">Вопросы, уточнения и ответы сервиса</p>
          </header>
          {!request ? (
            <EmptyState
              title="Сообщения появятся после обращения"
              description="Завершите диагностику и создайте обращение — менеджер ответит здесь."
              action={
                <Button variant="secondary" onClick={continueConsultation}>
                  Продолжить диагностику
                </Button>
              }
            />
          ) : (
            <>
              <div className="case-messages-thread">
                {messages.length === 0 ? (
                  <EmptyState
                    title="Сообщений пока нет"
                    description="Напишите менеджеру — ответ появится здесь."
                  />
                ) : (
                  <ul className="message-thread message-thread-bubbles">
                    {messages.map((msg) => {
                      const isClient = msg.author?.role === 'CLIENT';
                      const name = isClient ? 'Вы' : msg.author?.fullName || 'Менеджер';
                      const initial = name.trim().charAt(0).toUpperCase() || '?';
                      return (
                        <li
                          key={msg.id}
                          className={`message-bubble ${isClient ? 'is-client' : 'is-staff'}`}
                        >
                          <span className="message-bubble-avatar" aria-hidden>
                            {initial}
                          </span>
                          <div className="message-bubble-body">
                            <div className="message-thread-meta">
                              <strong>{name}</strong>
                              <time>{formatDate(msg.createdAt)}</time>
                            </div>
                            {msg.body ? <p>{msg.body}</p> : null}
                            <MessageAttachmentList attachments={msg.attachments} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="case-messages-compose message-compose">
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
                  placeholder="Написать менеджеру..."
                  rows={2}
                  disabled={isClosed}
                />
                {isClosed ? (
                  <p className="muted-text">Обращение закрыто — новые сообщения недоступны.</p>
                ) : null}
                {actionError ? <p className="form-error">{actionError}</p> : null}
                <div className="case-messages-compose-row">
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
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'booking' ? (
        <div className="case-detail-panel" role="tabpanel" id="tabpanel-booking" aria-labelledby="tab-booking">
          <header className="case-detail-section-head">
            <h2>Визит в сервис</h2>
            <p className="muted-text">Дата и статус приезда</p>
          </header>
          <CaseVisitPanel
            bookingId={bookingId}
            preferredAt={bookingPreferredAt}
            status={bookingStatus}
            onBook={goToBooking}
          />
        </div>
      ) : null}

      <div className="case-detail-sticky-actions case-next-step-actions" data-tone={nextStep.tone}>
        <button
          type="button"
          className="case-next-cta is-primary"
          onClick={() => handleNextStepAction(nextStep.primary.action)}
        >
          {nextStep.primary.label}
        </button>
        {nextStep.secondary ? (
          <button
            type="button"
            className="case-next-cta is-secondary"
            onClick={() => handleNextStepAction(nextStep.secondary!.action)}
          >
            {nextStep.secondary.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
