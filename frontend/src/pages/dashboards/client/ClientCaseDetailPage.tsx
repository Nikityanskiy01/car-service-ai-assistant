import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CarFront,
  ChevronRight,
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
import { ClientStatusBadge } from '../../../components/client/ClientStatusBadge';
import { CaseProgressRail } from '../../../components/client/CaseProgressRail';
import { CaseVisitPanel } from '../../../components/client/CaseVisitPanel';
import { MessageAttachmentInput, type PendingAttachment } from '../../../components/requests/MessageAttachmentInput';
import { FollowUpChatPanel } from '../../../components/messages/FollowUpChatPanel';
import { DiagnosticSummary } from '../../../components/consultation/DiagnosticSummary';
import { Breadcrumbs } from '../../../components/layout/dashboard/Breadcrumbs';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
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
  { id: 'booking', label: 'Запись', icon: CalendarCheck2 },
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
    description: 'Обзор, диагностика, сообщения и запись.',
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
  const createdLabel = request ? formatDate(request.createdAt) : consultation?.messages?.[0]?.createdAt
    ? formatDate(consultation.messages[0].createdAt)
    : null;

  const quickLinks = [
    {
      id: 'diagnosis' as const,
      tab: 'diagnosis' as const,
      label: 'Диагностика',
      hint: diagnosis || recommendation ? 'Результат ИИ готов' : 'Открыть разбор',
      icon: Sparkles,
    },
    {
      id: 'messages' as const,
      tab: 'messages' as const,
      label: 'Сообщения',
      hint: request ? (messages.length ? `${messages.length} в переписке` : 'Написать менеджеру') : 'После обращения',
      icon: MessageSquare,
      disabled: !request,
    },
    {
      id: 'booking' as const,
      tab: 'booking' as const,
      label: 'Запись',
      hint: bookingPreferredAt
        ? visitStatusHeadline(bookingStatus, formatDate(bookingPreferredAt))
        : 'Записаться в сервис',
      icon: CalendarCheck2,
    },
  ];

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
        <div className="case-detail-hero-accent" aria-hidden />
        <div className="case-detail-hero-top">
          <div className="case-detail-hero-copy">
            <div className="case-detail-hero-meta">
              {request ? <ClientStatusBadge status={request.status} /> : null}
              {isDraft ? <span className="case-detail-draft-chip">Черновик</span> : null}
            </div>
            <p className="case-detail-kicker">
              <CarFront size={14} aria-hidden />
              <span>{car}</span>
              {requestNumber ? <span className="case-detail-kicker-sep">·</span> : null}
              {requestNumber ? <span>{requestNumber}</span> : null}
              {createdLabel ? <span className="case-detail-kicker-sep">·</span> : null}
              {createdLabel ? <time dateTime={request?.createdAt}>{createdLabel}</time> : null}
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

      <div className="case-detail-nav-shell">
        <CaseProgressRail
          clientCase={clientCase}
          requestCreatedAt={request?.createdAt}
          bookingPreferredAt={bookingPreferredAt}
          bookingStatus={bookingStatus}
          onStepClick={(stepTab: ClientCaseDetailTab) => {
            if (stepTab !== 'progress') setTab(stepTab);
          }}
        />

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
      </div>

      {tab === 'progress' ? (
        <div className="case-detail-panel" role="tabpanel" id="tabpanel-progress" aria-labelledby="tab-progress">
          <div className="case-detail-overview">
            <div className="case-quick-links" aria-label="Разделы обращения">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.id}
                    type="button"
                    className={`case-quick-link${link.disabled ? ' is-disabled' : ''}`}
                    data-quick={link.id}
                    disabled={link.disabled}
                    onClick={() => setTab(link.tab)}
                  >
                    <span className="case-quick-link-icon" aria-hidden>
                      <Icon size={18} />
                    </span>
                    <span className="case-quick-link-copy">
                      <strong>{link.label}</strong>
                      <span>{link.hint}</span>
                    </span>
                    <ChevronRight className="case-quick-link-chevron" size={18} aria-hidden />
                  </button>
                );
              })}
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
                      ? 'Откройте вкладку «Запись» для деталей'
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
            <FollowUpChatPanel
              messages={messages}
              value={reply}
              onChange={setReply}
              onSubmit={handleSend}
              disabled={isClosed}
              sending={sending}
              error={actionError}
              placeholder="Написать менеджеру..."
              attachments={pendingAttachments}
              onAttachmentsChange={setPendingAttachments}
              templates={isClosed ? undefined : [...CLIENT_MESSAGE_TEMPLATES]}
              closedMessage={isClosed ? 'Обращение закрыто — новые сообщения недоступны.' : undefined}
              viewerRole="CLIENT"
              emptyTitle="Сообщений пока нет"
              emptyDescription="Напишите менеджеру — ответ появится здесь."
            />
          )}
        </div>
      ) : null}

      {tab === 'booking' ? (
        <div className="case-detail-panel" role="tabpanel" id="tabpanel-booking" aria-labelledby="tab-booking">
          <header className="case-detail-section-head">
            <h2>Запись в сервис</h2>
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
