import type { ConsultationRecommendation } from '../../types/consultation';
import type { ConsultationDiagnosisSnapshot } from '../../types/consultation';
import type { ConsultationDetail } from '../../types/consultation';
import { formatManualReviewHint } from '../../features/consultations/localizeDiagnosisReason';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { CriticalSafetyBanner } from './CriticalSafetyBanner';
import { DiagnosisActions } from './DiagnosisActions';
import { EstimatedPriceCard } from './EstimatedPriceCard';
import { MasterChecksChecklist } from './MasterChecksChecklist';
import { ObdCodesSummary } from './ObdCodesSummary';
import { PossibleCausesList } from './PossibleCausesList';
import { UrgencyBadge } from './UrgencyBadge';

function sameText(a?: string | null, b?: string | null) {
  return String(a || '')
    .trim()
    .toLowerCase() === String(b || '').trim().toLowerCase();
}

export function DiagnosticSummary({
  detail,
  recommendations,
  diagnosis,
  fallbackCost,
  fallbackConfidence,
  onCreateRequest,
  variant = 'default',
}: {
  detail?: ConsultationDetail | null;
  recommendations: ConsultationRecommendation[];
  diagnosis?: ConsultationDiagnosisSnapshot | null;
  fallbackCost?: number | null;
  fallbackConfidence?: number | null;
  onCreateRequest?: () => void;
  variant?: 'default' | 'staff';
}) {
  const isStaff = variant === 'staff';
  const isServiceHistory =
    detail?.flowState?.stage === 'SERVICE_HISTORY' || Boolean(detail?.flowState?.maintenance_cta);

  if (isServiceHistory) {
    const plan = detail?.flowState?.service_history_plan;
    const status = plan?.status || detail?.flowState?.maintenance_cta?.status;
    return (
      <section
        className={`diagnostic-summary diagnostic-summary--service-history ${
          status === 'overdue' ? 'is-overdue' : status === 'soon' ? 'is-soon' : ''
        }`}
        aria-label="История обслуживания"
      >
        <header className="diagnostic-summary__header">
          <h3>Сервисная книжка</h3>
          <span className="diagnostic-summary__status">Замена масла</span>
        </header>
        <p className="diagnostic-summary__lead">
          Ответ по вашей истории обслуживания. Можно сразу записаться или открыть книжку авто.
        </p>
        {plan?.hasHistory && plan.lastRecord ? (
          <div className="service-history-snapshot">
            <div>
              <span className="muted">Последняя</span>
              <strong>
                {plan.lastRecord.performedAt
                  ? new Date(plan.lastRecord.performedAt).toLocaleDateString('ru-RU')
                  : '—'}
              </strong>
            </div>
            {plan.plan?.nextDueAt ? (
              <div>
                <span className="muted">Следующая</span>
                <strong>{new Date(plan.plan.nextDueAt).toLocaleDateString('ru-RU')}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
        <DiagnosisActions detail={detail ?? null} />
      </section>
    );
  }

  if (!recommendations.length && !diagnosis && !fallbackCost && !fallbackConfidence) return null;
  const isManualReview = diagnosis?.analysis_available === false || diagnosis?.status === 'MANUAL_REVIEW_REQUIRED';
  if (isManualReview) {
    const hint = formatManualReviewHint(diagnosis?.reason);
    return (
      <section className="diagnostic-summary diagnostic-summary--manual" aria-label="Статус интеллектуального анализа">
        <header className="diagnostic-summary__header">
          <h3>Интеллектуальный анализ</h3>
          <span className="diagnostic-summary__status">Ручная обработка</span>
        </header>
        <p className="diagnostic-summary__lead">
          {diagnosis?.summary ||
            'Автоматический анализ сейчас недоступен. Введённые данные сохранены — вы можете повторить попытку или передать обращение менеджеру.'}
        </p>
        <p className="diagnostic-summary__meta">{hint}</p>
        {onCreateRequest ? (
          <div className="diagnosis-actions">
            <button type="button" className="btn btn-primary diagnosis-request-btn" onClick={onCreateRequest}>
              Передать менеджеру
            </button>
          </div>
        ) : null}
      </section>
    );
  }
  const top = recommendations[0];
  const confidence =
    typeof diagnosis?.confidence === 'number'
      ? Math.round(diagnosis.confidence * 100)
      : typeof top?.confidence === 'number'
      ? Math.round(top.confidence * 100)
      : typeof top?.probabilityPercent === 'number'
        ? top.probabilityPercent
        : fallbackConfidence || 0;
  const summaryText = String(diagnosis?.summary || '').trim() || top?.summary || top?.title || '';
  const hasRealCause = recommendations.some((item) => {
    const title = String(item.title || item.summary || '').trim();
    return title.length > 0 && !/^неопредел/i.test(title);
  });
  const isWeak =
    confidence <= 0 &&
    !hasRealCause &&
    (!summaryText || /уточнен/i.test(summaryText) || /недостаточно/i.test(summaryText));

  if (isWeak) {
    return (
      <section className="diagnostic-summary diagnostic-summary--manual is-weak" aria-label="Диагностика ожидает данных">
        <header className="diagnostic-summary__header">
          <h3>Диагностика ещё собирает данные</h3>
        </header>
        <p className="diagnostic-summary__lead">
          Пока недостаточно симптомов для уверенного разбора. Менеджер уточнит детали в переписке или на
          записи. Предварительные причины появятся здесь.
        </p>
        <p className="diagnostic-summary__meta">Это не диагноз. Точный вывод возможен после очной проверки в сервисе.</p>
        {onCreateRequest ? (
          <div className="diagnosis-actions">
            <button type="button" className="btn btn-primary diagnosis-request-btn" onClick={onCreateRequest}>
              Передать менеджеру
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  const isCritical = String(diagnosis?.urgency || top?.urgency || '').toLowerCase() === 'critical';
  const diagnosisChecks = Array.isArray(diagnosis?.recommended_checks)
    ? diagnosis.recommended_checks
    : [];
  const checksFromRecs = recommendations.flatMap((item) => item.checks || []).filter(Boolean);
  const allChecks = diagnosisChecks.length ? diagnosisChecks : checksFromRecs;
  const obdItems = detail?.flowState?.obd_interpretations || [];
  const usableRecommendations = recommendations.filter((item) => {
    const title = String(item.title || item.summary || '').trim();
    return title.length > 0 && !/^неопредел/i.test(title);
  });
  const distinctCauses = usableRecommendations.filter(
    (item) => !sameText(item.title || item.summary, summaryText),
  );
  const costFrom = diagnosis?.estimated_cost_from ?? top?.costFromMinor ?? fallbackCost ?? null;
  const costLabel =
    typeof costFrom === 'number' && costFrom > 0
      ? `от ${costFrom.toLocaleString('ru-RU')} ₽`
      : 'нужны уточнения';

  return (
    <section
      className={`diagnostic-summary${isStaff ? ' diagnostic-summary--staff' : ''}`}
      aria-label={isStaff ? 'Разбор ИИ' : 'Предварительный результат анализа'}
    >
      {isStaff ? null : (
        <header className="diagnostic-summary__header">
          <h3>Предварительный результат анализа</h3>
          <UrgencyBadge urgency={diagnosis?.urgency || top?.urgency} />
        </header>
      )}
      {isCritical ? <CriticalSafetyBanner /> : null}
      <p className={isStaff ? 'request-analysis-body' : undefined}>
        {summaryText || 'Краткий разбор по описанным симптомам.'}
      </p>
      {isStaff ? (
        <dl className="request-analysis-metrics">
          <div>
            <dt>Уверенность</dt>
            <dd className="tnum">{confidence}%</dd>
          </div>
          <div>
            <dt>Оценка</dt>
            <dd className="tnum">{costLabel}</dd>
          </div>
        </dl>
      ) : (
        <div className="analysis-grid">
          <ConfidenceIndicator value={confidence} />
          <EstimatedPriceCard amount={costFrom} />
        </div>
      )}
      <ObdCodesSummary items={obdItems} />
      <PossibleCausesList
        recommendations={distinctCauses}
        overallConfidence={diagnosis?.confidence}
        variant={isStaff ? 'staff' : 'default'}
      />
      <MasterChecksChecklist
        checks={allChecks}
        title={isStaff ? 'В сервис' : undefined}
        hint={isStaff ? null : undefined}
      />
      {isStaff ? null : <DiagnosisActions detail={detail ?? null} onCreateRequest={onCreateRequest} />}
      {isStaff ? (
        <p className="analysis-disclaimer">Не заменяет диагностику в сервисе.</p>
      ) : (
        <p className="analysis-disclaimer">
          {diagnosis?.execution_meta?.provider ? `Источник: ${diagnosis.execution_meta.provider}. ` : ''}
          {detail?.flowState?.photo_observations?.disclaimer
            ? `${detail.flowState.photo_observations.disclaimer} `
            : ''}
          {diagnosis?.disclaimer ||
            'Результат сформирован на основе предоставленных данных и не заменяет техническую диагностику автомобиля специалистом.'}
        </p>
      )}
    </section>
  );
}
