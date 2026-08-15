import { useEffect, useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { getLlmEvalReport } from '../../../api/adminAi';
import { getLlmStatus, type LlmStatus } from '../../../api/dashboard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminAiStatusPage() {
  usePageMeta({ title: 'Статус ИИ', description: 'Мониторинг интеллектуального модуля и моделей.' });
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [evalReport, setEvalReport] = useState<Awaited<ReturnType<typeof getLlmEvalReport>> | null>(null);

  async function load(probe = false) {
    if (probe) setProbing(true);
    else setLoading(true);
    setError(null);
    try {
      const [llm, evalData] = await Promise.all([getLlmStatus(probe), getLlmEvalReport().catch(() => null)]);
      setStatus(llm);
      setEvalReport(evalData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
      setProbing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loader label="Загружаем статус ИИ..." />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const stateLabel =
    status?.state === 'ok'
      ? 'Работает'
      : status?.state === 'degraded'
        ? 'Резервный режим'
        : status?.state === 'disabled'
          ? 'Отключён'
          : 'Недоступен';

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Статус и модели"
        description="Конфигурация LLM, метрики и проверка доступности."
        actions={
          <div className="row gap-sm">
            {evalReport ? (
              <span className={`eval-badge${evalReport.ok ? ' is-ok' : ' is-bad'}`} title="Rule-based eval набора промптов">
                Eval {evalReport.passed}/{evalReport.total}
              </span>
            ) : null}
            <Button variant="secondary" disabled={probing} onClick={() => void load(true)}>
              {probing ? 'Проверка…' : 'Проверить сейчас'}
            </Button>
          </div>
        }
      />

      <Card className="llm-status-card">
        <div className="card-section-header">
          <h2>
            <BrainCircuit size={18} aria-hidden /> Интеллектуальный модуль
          </h2>
          <span className={`llm-status-pill is-${status?.state || 'unavailable'}`}>{stateLabel}</span>
        </div>
        {status ? (
          <dl className="detail-dl desk-profile-dl">
            <div>
              <dt>Сообщение</dt>
              <dd>{status.message || '—'}</dd>
            </div>
            <div>
              <dt>Провайдер</dt>
              <dd>{status.provider}</dd>
            </div>
            <div>
              <dt>Fallback</dt>
              <dd>{status.fallbackEnabled ? 'включён' : 'выключен'}</dd>
            </div>
            <div>
              <dt>Модель извлечения</dt>
              <dd>{status.models.extraction}</dd>
            </div>
            <div>
              <dt>Модель диагноза</dt>
              <dd>{status.models.diagnosis}</dd>
            </div>
            {status.models.embedding ? (
              <div>
                <dt>Embedding</dt>
                <dd>{status.models.embedding}</dd>
              </div>
            ) : null}
            {status.metrics ? (
              <>
                <div>
                  <dt>Успешных вызовов</dt>
                  <dd>
                    {status.metrics.successRatePercent}% ({status.metrics.successes}/{status.metrics.totalCalls})
                  </dd>
                </div>
                <div>
                  <dt>Fallback rate</dt>
                  <dd>{status.metrics.fallbackRatePercent}%</dd>
                </div>
                <div>
                  <dt>Ошибки валидации</dt>
                  <dd>{status.metrics.validationFailures}</dd>
                </div>
                <div>
                  <dt>Latency p95</dt>
                  <dd>{status.metrics.latencyMs.p95 != null ? `${status.metrics.latencyMs.p95} мс` : '—'}</dd>
                </div>
              </>
            ) : null}
            {status.circuitBreaker ? (
              <div>
                <dt>Circuit breaker</dt>
                <dd>{status.circuitBreaker.state}</dd>
              </div>
            ) : null}
            {status.diagnosisCache ? (
              <div>
                <dt>Кэш диагнозов</dt>
                <dd>
                  {status.diagnosisCache.enabled
                    ? `${status.diagnosisCache.size} / ${status.diagnosisCache.maxEntries}`
                    : 'выкл'}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Card>

      {evalReport ? (
        <Card>
          <div className="card-section-header">
            <h2>Eval-набор промптов</h2>
            <span className={`eval-badge${evalReport.ok ? ' is-ok' : ' is-bad'}`}>
              {evalReport.ok ? 'Без регрессии' : 'Есть ошибки'}
            </span>
          </div>
          <p className="muted">
            Rule-based сценарии: {evalReport.passed} из {evalReport.total} пройдено. Контракты промптов:{' '}
            {evalReport.promptOk ? 'OK' : 'ошибки'}.
          </p>
          <p className="muted">Проверено: {new Date(evalReport.checkedAt).toLocaleString('ru-RU')}</p>
          {evalReport.failedCount ? (
            <ul className="simple-list">
              {evalReport.failed.map((f) => (
                <li key={f.id}>
                  <strong>{f.id}</strong>
                  <span>{f.issues.join('; ')}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
