import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { AnalysisProgress } from '../../components/consultation/AnalysisProgress';
import { CollectedVehicleData } from '../../components/consultation/CollectedVehicleData';
import { ConsultationChat } from '../../components/consultation/ConsultationChat';
import { ConsultationProgress } from '../../components/consultation/ConsultationProgress';
import { DiagnosticSummary } from '../../components/consultation/DiagnosticSummary';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { useConsultationStream } from '../../features/consultations/useConsultationStream';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import type { ConsultationDetail } from '../../types/consultation';

const quickReplies = [
  'Появился посторонний стук при проезде неровностей',
  'Затруднённый запуск холодного двигателя',
  'Вибрация при торможении на скорости',
  'Нестабильные обороты на холостом ходу',
];

const STAGE_LABELS: Record<string, string> = {
  INITIAL: 'Консультация ещё не начата',
  COLLECTING_VEHICLE: 'Собираем данные об автомобиле',
  COLLECTING_SYMPTOMS: 'Уточняем основной симптом',
  CLARIFYING: 'Собираем уточнения для анализа',
  READY_FOR_ANALYSIS: 'Данные собраны, готовим запуск анализа',
  ANALYZING: 'Выполняем интеллектуальный анализ',
  COMPLETED: 'Анализ завершён. Вы можете создать заявку или задать дополнительный вопрос.',
  MANUAL_REVIEW_REQUIRED: 'Интеллектуальный анализ недоступен. Можно передать обращение менеджеру для ручной обработки.',
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
  usePageMeta({
    title: 'Демонстрационная консультация',
    description:
      'Диалог с ассистентом: сбор данных автомобиля, интеллектуальный анализ обращения и автоматическое формирование заявки.',
  });
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
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const { start, stop } = useConsultationStream();
  const stage = String(detail?.flowState?.stage || '');
  const statusText =
    STAGE_LABELS[stage] ||
    (detail?.diagnosis?.execution_meta?.provider
      ? `Источник анализа: ${detail.diagnosis.execution_meta.provider}`
      : undefined);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  async function bootstrapSession() {
    setError(null);
    try {
      const created = await api<{ id: string; guestToken?: string }>('/consultations', { method: 'POST', body: {} });
      setSessionId(created.id);
      sessionStorage.setItem(STORAGE_KEYS.consultSessionId, created.id);
      if (created.guestToken) {
        setGuestToken(created.guestToken);
        sessionStorage.setItem(STORAGE_KEYS.consultGuestToken, created.guestToken);
        sessionStorage.setItem(STORAGE_KEYS.consultMode, 'guest');
      }
      const loaded = await api<ConsultationDetail>(`/consultations/${created.id}`, { guestToken: created.guestToken });
      setDetail(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать консультацию');
    }
  }

  async function loadSession(id: string, token?: string | null) {
    const loaded = await api<ConsultationDetail>(`/consultations/${id}`, { guestToken: token });
    setDetail(loaded);
  }

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId || !message.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    setPhase('started');
    try {
      await start({
        sessionId,
        content: message.trim(),
        guestToken,
        handlers: {
          onThinking: () => setPhase('started'),
          onProgress: (payload) => {
            const p = payload as { phase?: string };
            if (p?.phase) setPhase(p.phase);
          },
          onDone: (payload) => {
            setDetail(payload as ConsultationDetail);
            setPhase(null);
          },
          onError: (payload) => {
            setPhase(null);
            setError(localizeStreamError(payload));
          },
        },
      });
      setMessage('');
    } catch (e) {
      setPhase(null);
      setError((prev) => prev ?? localizeThrownError(e));
    } finally {
      setIsSending(false);
    }
  }

  async function createServiceRequest() {
    if (!sessionId || creatingRequest) return;
    setCreatingRequest(true);
    setError(null);
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
            },
          });
      setSuccessRequestId(payload.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать заявку');
    } finally {
      setCreatingRequest(false);
    }
  }

  return (
    <div className="consultation-page">
      <header className="consultation-page-head">
        <div>
          <h1>Консультация с ИИ-ассистентом</h1>
          <p>Сценарий демонстрации: диалог, анализ обращения и создание структурированной заявки.</p>
        </div>
        <div className="row gap-sm">
          <span className={`connect-status ${online ? 'online' : 'offline'}`}>
            {online ? 'Соединение активно' : 'Офлайн-режим'}
          </span>
          {!sessionId ? (
            <Button onClick={() => void bootstrapSession()}>Начать консультацию</Button>
          ) : (
            <Button variant="ghost" onClick={() => void loadSession(sessionId, guestToken)}>
              Обновить данные
            </Button>
          )}
        </div>
      </header>

      {error ? <p className="error-text">{error}</p> : null}
      {!sessionId ? (
        <Card>
          <h3>Запустите консультацию</h3>
          <p>После запуска ассистент начнёт уточнение по автомобилю и симптомам.</p>
          <Button onClick={() => void bootstrapSession()}>Начать новую сессию</Button>
        </Card>
      ) : (
        <div className="consultation-layout">
          <main className="consultation-main">
            <ConsultationProgress progress={detail?.progressPercent ?? 0} phase={phase} statusText={statusText} />
            <AnalysisProgress phase={phase} online={online} />
            <Card>
              <ConsultationChat messages={detail?.messages || []} isTyping={!!phase && isSending} />
              <div className="quick-replies">
                {quickReplies.map((reply) => (
                  <button key={reply} type="button" onClick={() => setMessage(reply)}>
                    {reply}
                  </button>
                ))}
              </div>
              <form className="consultation-input" onSubmit={onSend}>
                <Input
                  placeholder="Опишите симптомы или ответьте на уточняющий вопрос"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  required
                />
                <Button disabled={isSending || !sessionId}>{isSending ? 'Отправка...' : 'Отправить'}</Button>
              </form>
            </Card>
          </main>

          <aside className="consultation-side">
            <CollectedVehicleData data={detail?.extracted} />
            <DiagnosticSummary
              recommendations={detail?.recommendations || []}
              diagnosis={detail?.diagnosis}
              fallbackCost={detail?.costFromMinor}
              fallbackConfidence={detail?.confidencePercent}
            />

            <Card>
              <h3>Создание заявки</h3>
              {!isAuthenticated ? (
                <div className="stack">
                  <Input
                    placeholder="Ваше имя"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                  <Input
                    placeholder="Телефон"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>
              ) : null}
              <Button
                disabled={creatingRequest || (!isAuthenticated && (!guestName || !guestPhone))}
                onClick={() => void createServiceRequest()}
              >
                {creatingRequest ? 'Создание...' : 'Создать заявку'}
              </Button>
              {successRequestId ? (
                <div className="success-block" role="status" aria-live="polite">
                  <h4>Заявка создана</h4>
                  <p>Номер: {successRequestId.slice(0, 8)}</p>
                  <p>Статус: NEW</p>
                  <p>Дальше менеджер продолжит обработку обращения в своем кабинете.</p>
                </div>
              ) : null}
            </Card>
          </aside>
        </div>
      )}

      {phase ? <Loader label={`Этап: ${phase}`} /> : null}
    </div>
  );
}
