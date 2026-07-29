import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { AnalysisProgress } from '../../components/consultation/AnalysisProgress';
import { ConsultationChat } from '../../components/consultation/ConsultationChat';
import { ConsultationProgress } from '../../components/consultation/ConsultationProgress';
import { DiagnosticSummary } from '../../components/consultation/DiagnosticSummary';
import { ObdCodesPanel } from '../../components/consultation/ObdCodesPanel';
import { PhotoAttachment } from '../../components/consultation/PhotoAttachment';
import { QuickReplies } from '../../components/consultation/QuickReplies';
import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { Tabs } from '../../components/ui/Tabs';
import { Textarea } from '../../components/ui/Textarea';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import { useConsultationStream } from '../../features/consultations/useConsultationStream';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import type { ConsultationDetail } from '../../types/consultation';

const STAGE_LABELS: Record<string, string> = {
  INITIAL: 'Уточняем автомобиль и симптомы',
  COLLECTING_VEHICLE: 'Собираем данные об автомобиле',
  COLLECTING_SYMPTOMS: 'Уточняем основной симптом',
  CLARIFYING: 'Собираем уточнения для анализа',
  READY_FOR_ANALYSIS: 'Данные собраны, готовим запуск анализа',
  ANALYZING: 'Выполняем интеллектуальный анализ',
  COMPLETED: 'Анализ завершён. Можно создать заявку или задать вопрос.',
  MANUAL_REVIEW_REQUIRED: 'Анализ недоступен. Можно передать обращение менеджеру.',
  FAILED: 'Не удалось завершить анализ. Попробуйте повторить.',
};

function localizeStreamError(payload: unknown): string {
  const p = (payload || {}) as { message?: string; code?: string };
  if (String(p.code || '').toUpperCase() === 'LLM_ERROR') {
    return 'Сервис интеллектуального анализа временно недоступен. Вы можете сохранить обращение и передать его менеджеру.';
  }
  if (String(p.code || '').toUpperCase() === 'STREAM_ABORTED') {
    return 'Соединение с потоком ответа прервано. Попробуйте отправить сообщение ещё раз.';
  }
  const raw = String(p.message || '').trim().toLowerCase();
  if (!raw) return 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
  if (raw.includes('aborted') || raw.includes('timeout')) {
    return 'Не удалось получить ответ интеллектуального ассистента вовремя. Введённые данные сохранены. Повторите запрос или передайте обращение менеджеру.';
  }
  return String(p.message || 'Не удалось обработать сообщение. Попробуйте повторить отправку.');
}

function localizeThrownError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const low = raw.toLowerCase();
  if (low.includes('aborted') || low.includes('timeout')) {
    return 'Не удалось получить ответ интеллектуального ассистента вовремя. Введённые данные сохранены. Повторите запрос или передайте обращение менеджеру.';
  }
  if (low.includes('failed to fetch') || low.includes('network')) {
    return 'Нет подключения к серверу. Проверьте соединение и повторите попытку.';
  }
  return raw || 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
}

export function ConsultPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Интеллектуальная диагностика',
    description: 'Чат-диагностика симптомов до визита в автосервис.',
  });
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const online = useOnlineStatus();
  const [sessionId, setSessionId] = useState<string | null>(sessionStorage.getItem(STORAGE_KEYS.consultSessionId));
  const [guestToken, setGuestToken] = useState<string | null>(
    sessionStorage.getItem(STORAGE_KEYS.consultGuestToken),
  );
  const [detail, setDetail] = useState<ConsultationDetail | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(!sessionStorage.getItem(STORAGE_KEYS.consultSessionId));
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestConsent, setGuestConsent] = useState(false);
  const [guestConsentError, setGuestConsentError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.consultPrefill);
      if (!raw) return;
      const data = JSON.parse(raw) as { fullName?: string; phone?: string };
      if (data.fullName) setGuestName(data.fullName);
      if (data.phone) setGuestPhone(data.phone);
      sessionStorage.removeItem(STORAGE_KEYS.consultPrefill);
    } catch {
      /* ignore */
    }
  }, []);

  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('chat');
  const bootRef = useRef(false);
  const retryRef = useRef<(() => void) | null>(null);
  const { start, stop } = useConsultationStream();
  const stage = String(detail?.flowState?.stage || 'INITIAL');
  const statusText =
    STAGE_LABELS[stage] ||
    (detail?.diagnosis?.execution_meta?.provider
      ? `Источник анализа: ${detail.diagnosis.execution_meta.provider}`
      : STAGE_LABELS.INITIAL);
  const hasUserMessages = (detail?.messages || []).some((m) => m.sender === 'USER');
  const showQuickReplies = !hasUserMessages && !isSending;
  const diagnosisPending = useMemo(() => {
    if (!detail) return false;
    return (
      detail.flowState?.stage === 'DIAGNOSIS_QUEUED' ||
      detail.diagnosisJob?.status === 'PENDING' ||
      detail.diagnosisJob?.status === 'PROCESSING'
    );
  }, [detail]);

  function setErrorWithRetry(msg: string, retry?: () => void) {
    setError(msg);
    retryRef.current = retry ?? null;
  }

  function clearError() {
    setError(null);
    retryRef.current = null;
  }

  function handleRetry() {
    clearError();
    if (retryRef.current) {
      retryRef.current();
      return;
    }
    if (sessionId) {
      void refreshSession();
      return;
    }
    void bootstrapSession();
  }

  function goToBooking() {
    prefillBookingFromConsultation({
      detail,
      serviceRequestId: successRequestId ?? undefined,
      fullName: !isAuthenticated ? guestName : undefined,
      phone: !isAuthenticated ? guestPhone : undefined,
    });
    navigate('/booking');
  }

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    void (async () => {
      const existingId = sessionStorage.getItem(STORAGE_KEYS.consultSessionId);
      const existingToken = sessionStorage.getItem(STORAGE_KEYS.consultGuestToken);
      try {
        if (existingId) {
          setBootstrapping(true);
          await loadSession(existingId, existingToken);
          setSessionId(existingId);
          setGuestToken(existingToken);
        } else {
          await bootstrapSession();
        }
      } catch (e) {
        setErrorWithRetry(
          e instanceof Error ? e.message : 'Не удалось открыть консультацию',
          () => void bootstrapSession(),
        );
      } finally {
        setBootstrapping(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once bootstrap
  }, []);

  useEffect(() => {
    if (!sessionId || !diagnosisPending) return;
    setPhase('diagnosing');
    const timer = window.setInterval(() => {
      void api<ConsultationDetail>(`/consultations/${sessionId}`, { guestToken }).then((loaded) => {
        setDetail(loaded);
        if (loaded.status === 'COMPLETED' || loaded.diagnosisJob?.status === 'FAILED') {
          setPhase(null);
        }
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [sessionId, guestToken, diagnosisPending]);

  async function bootstrapSession() {
    clearError();
    setBootstrapping(true);
    setSuccessRequestId(null);
    try {
      const created = await api<{ id: string; guestToken?: string }>('/consultations', { method: 'POST', body: {} });
      setSessionId(created.id);
      sessionStorage.setItem(STORAGE_KEYS.consultSessionId, created.id);
      if (created.guestToken) {
        setGuestToken(created.guestToken);
        sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, created.guestToken);
        sessionStorage.setItem(STORAGE_KEYS.consultMode, 'guest');
      } else {
        setGuestToken(null);
        sessionStorage.removeItem(STORAGE_KEYS.consultGuestToken);
      }
      const loaded = await api<ConsultationDetail>(`/consultations/${created.id}`, { guestToken: created.guestToken });
      setDetail(loaded);
    } catch (e) {
      setErrorWithRetry(
        e instanceof Error ? e.message : 'Не удалось создать консультацию',
        () => void bootstrapSession(),
      );
      throw e;
    } finally {
      setBootstrapping(false);
    }
  }

  async function loadSession(id: string, token?: string | null) {
    const loaded = await api<ConsultationDetail>(`/consultations/${id}`, { guestToken: token });
    setDetail(loaded);
  }

  async function refreshSession() {
    if (!sessionId) return;
    clearError();
    setBootstrapping(true);
    try {
      await loadSession(sessionId, guestToken);
    } catch (e) {
      setErrorWithRetry(
        e instanceof Error ? e.message : 'Не удалось обновить консультацию',
        () => void refreshSession(),
      );
    } finally {
      setBootstrapping(false);
    }
  }

  async function startNewSession() {
    sessionStorage.removeItem(STORAGE_KEYS.consultSessionId);
    sessionStorage.removeItem(STORAGE_KEYS.consultGuestToken);
    setSessionId(null);
    setDetail(null);
    setMessage('');
    setPhase(null);
    setMobilePanel('chat');
    await bootstrapSession();
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!sessionId || !trimmed || isSending || !online) return;
    setIsSending(true);
    clearError();
    setPhase('started');
    try {
      await start({
        sessionId,
        content: trimmed,
        guestToken,
        handlers: {
          onThinking: () => setPhase('started'),
          onProgress: (payload) => {
            const p = payload as { phase?: string };
            if (p?.phase) setPhase(p.phase);
          },
          onDone: (payload) => {
            const loaded = payload as ConsultationDetail;
            setDetail(loaded);
            const pending =
              loaded.flowState?.stage === 'DIAGNOSIS_QUEUED' ||
              loaded.diagnosisJob?.status === 'PENDING' ||
              loaded.diagnosisJob?.status === 'PROCESSING';
            setPhase(pending ? 'diagnosing' : null);
          },
          onError: (payload) => {
            setPhase(null);
            setErrorWithRetry(localizeStreamError(payload), () => void sendMessage(trimmed));
          },
        },
      });
      setMessage('');
    } catch (e) {
      setPhase(null);
      setErrorWithRetry(localizeThrownError(e), () => void sendMessage(trimmed));
    } finally {
      setIsSending(false);
    }
  }

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    await sendMessage(message);
  }

  async function createServiceRequest() {
    if (!sessionId || creatingRequest) return;
    if (!isAuthenticated && !guestConsent) {
      setGuestConsentError('Отметьте согласие на обработку персональных данных');
      return;
    }
    setGuestConsentError(null);
    setCreatingRequest(true);
    clearError();
    try {
      const payload = isAuthenticated
        ? await api<{ id: string }>(`/consultations/${sessionId}/service-request`, { method: 'POST' })
        : await api<{ id: string }>(`/consultations/${sessionId}/service-request-guest`, {
            method: 'POST',
            guestToken,
            body: {
              fullName: guestName,
              phone: guestPhone,
              email: null,
              consentPersonalData: true,
            },
          });
      setSuccessRequestId(payload.id);
      setMobilePanel('result');
    } catch (e) {
      setErrorWithRetry(
        e instanceof Error ? e.message : 'Не удалось создать заявку',
        () => void createServiceRequest(),
      );
    } finally {
      setCreatingRequest(false);
    }
  }

  const sidePanelClass = mobilePanel !== 'result' ? 'consult-panel-hidden-mobile' : '';
  const mainPanelClass = mobilePanel !== 'chat' ? 'consult-panel-hidden-mobile' : '';

  return (
    <div className="fm-page consultation-page">
      <header className="consultation-page-head consult-head">
        <div>
          <h1>Интеллектуальная диагностика автомобиля</h1>
          <p>
            Опишите симптомы своими словами — «{productConfig.assistantName}» уточнит детали и подготовит предварительный
            отчёт. Это не замена осмотра на посту.
          </p>
        </div>
        <div className="consult-head-actions">
          <span className={`connect-status ${online ? 'online' : 'offline'}`}>
            {online ? 'Связь есть' : 'Нет сети'}
          </span>
          <Button variant="ghost" type="button" onClick={() => void startNewSession()} disabled={bootstrapping || isSending}>
            <Plus size={16} aria-hidden="true" />
            Новая сессия
          </Button>
        </div>
      </header>

      {!isAuthenticated ? (
        <div className="consult-guest-banner" role="status">
          Гостевой режим: история сохранится в этой сессии браузера.{' '}
          <Link to="/login?next=/consult">Войдите</Link>, чтобы вести обращения в кабинете.
        </div>
      ) : null}

      {error ? (
        <div className="consult-error-wrap">
          <ErrorState message={error} onRetry={handleRetry} />
        </div>
      ) : null}

      {bootstrapping && !detail ? (
        <Loader label="Открываем чат диагностики..." />
      ) : (
        <>
          <Tabs
            className="consult-mobile-tabs"
            items={[
              { id: 'chat', label: 'Чат' },
              { id: 'result', label: 'Результат и заявка' },
            ]}
            value={mobilePanel}
            onChange={setMobilePanel}
          />

          <div className="consultation-layout consultation-layout-fox">
            <aside className={`consultation-side ${sidePanelClass}`}>
              <ConsultationProgress
                progress={detail?.progressPercent ?? 0}
                phase={phase}
                stage={stage}
                statusText={statusText}
                extracted={detail?.extracted}
              />
              <DiagnosticSummary
                detail={detail}
                recommendations={detail?.recommendations || []}
                diagnosis={detail?.diagnosis}
                fallbackCost={detail?.costFromMinor}
                fallbackConfidence={detail?.confidencePercent}
              />
              <Card className="consult-request-card">
                <ObdCodesPanel
                  currentCodes={detail?.extracted?.obdCodes}
                  disabled={isSending || bootstrapping || !sessionId || !online}
                  onApply={(msg) => void sendMessage(msg)}
                />
                <h3>Создание заявки</h3>
                <p className="consult-request-hint">После диагностики оставьте контакты — менеджер свяжется с вами.</p>
                {!isAuthenticated ? (
                  <div className="fm-form consult-request-form stack">
                    <FormField label="Ваше имя" htmlFor="consultGuestName">
                      <Input
                        id="consultGuestName"
                        name="fullName"
                        autoComplete="name"
                        placeholder="Иван Иванов"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Телефон" htmlFor="consultGuestPhone">
                      <PhoneInput
                        id="consultGuestPhone"
                        name="phone"
                        value={guestPhone}
                        onChange={setGuestPhone}
                      />
                    </FormField>
                    <ConsentCheckbox
                      id="consultGuestConsent"
                      checked={guestConsent}
                      onChange={(v) => {
                        setGuestConsent(v);
                        if (v) setGuestConsentError(null);
                      }}
                      error={guestConsentError}
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="consult-request-btn"
                  disabled={
                    creatingRequest ||
                    (!isAuthenticated && (!guestName || !guestPhone || !guestConsent))
                  }
                  onClick={() => void createServiceRequest()}
                >
                  {creatingRequest ? 'Создание...' : 'Создать заявку'}
                </Button>
                {successRequestId ? (
                  <div className="success-block consult-success-block" role="status" aria-live="polite">
                    <h4>Заявка создана</h4>
                    <p>
                      Номер заявки: <strong>{formatRequestNumber(successRequestId)}</strong>
                    </p>
                    <p>
                      Статус: <strong>{SERVICE_REQUEST_STATUS_LABELS.NEW}</strong>
                    </p>
                    <p className="consult-success-hint">
                      Менеджер свяжется с вами для подтверждения деталей и времени визита.
                    </p>
                    <div className="consult-success-actions">
                      <Button type="button" variant="primary" onClick={goToBooking}>
                        Выбрать время визита
                      </Button>
                      {isAuthenticated ? (
                        <Link className="btn btn-secondary" to="/dashboard/client/requests">
                          В кабинет
                        </Link>
                      ) : (
                        <Link className="btn btn-secondary" to="/login?next=/dashboard/client">
                          Войти в кабинет
                        </Link>
                      )}
                    </div>
                  </div>
                ) : null}
              </Card>
            </aside>

            <main className={`consultation-main ${mainPanelClass}`}>
              <AnalysisProgress phase={phase} online={online} />
              {!online ? (
                <div className="consult-offline-banner" role="alert">
                  Нет подключения к сети. Сообщения сейчас не отправятся — проверьте Wi‑Fi или мобильный интернет.
                </div>
              ) : null}
              <Card className="consult-chat-card">
                <div className="consult-chat-body">
                  <ConsultationChat
                    messages={detail?.messages || []}
                    isTyping={!!phase && isSending}
                    assistantName={productConfig.assistantName}
                  />
                  {showQuickReplies ? (
                    <QuickReplies
                      disabled={isSending || !sessionId || bootstrapping || !online}
                      onSelect={(reply) => void sendMessage(reply)}
                    />
                  ) : null}
                </div>
                <form className="consultation-input consultation-input-stack" onSubmit={onSend}>
                  <PhotoAttachment
                    sessionId={sessionId || ''}
                    guestToken={guestToken}
                    disabled={isSending || bootstrapping || !sessionId || !online}
                    onAnalyzed={() => {
                      if (sessionId) void loadSession(sessionId, guestToken);
                    }}
                    onError={(msg) => setErrorWithRetry(msg, () => void refreshSession())}
                  />
                  <label className="consult-input-label" htmlFor="consultMessage">
                    Ваше сообщение
                  </label>
                  <Textarea
                    id="consultMessage"
                    placeholder="Марка, модель, пробег, затем неисправность или плановая работа..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={4000}
                    required
                    rows={3}
                    aria-label="Сообщение ассистенту"
                    disabled={isSending || bootstrapping || !online}
                  />
                  <div className="consult-send-row">
                    <Button disabled={isSending || !sessionId || bootstrapping || !online || !message.trim()}>
                      {isSending ? 'Отправка...' : 'Отправить'}
                    </Button>
                  </div>
                </form>
                <p className="consult-disclaimer consult-disclaimer-inline">
                  Ответ ассистента носит информационный характер и не заменяет очную диагностику в сервисе.
                </p>
              </Card>
            </main>
          </div>
        </>
      )}
    </div>
  );
}
