import type { ConsultationRecommendation } from '../../types/consultation';
import type { ConsultationDiagnosisSnapshot } from '../../types/consultation';
import type { ConsultationDetail } from '../../types/consultation';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { CriticalSafetyBanner } from './CriticalSafetyBanner';
import { DiagnosisActions } from './DiagnosisActions';
import { EstimatedPriceCard } from './EstimatedPriceCard';
import { MasterChecksChecklist } from './MasterChecksChecklist';
import { ObdCodesSummary } from './ObdCodesSummary';
import { PossibleCausesList } from './PossibleCausesList';
import { UrgencyBadge } from './UrgencyBadge';

export function DiagnosticSummary({
  detail,
  recommendations,
  diagnosis,
  fallbackCost,
  fallbackConfidence,
  onCreateRequest,
}: {
  detail?: ConsultationDetail | null;
  recommendations: ConsultationRecommendation[];
  diagnosis?: ConsultationDiagnosisSnapshot | null;
  fallbackCost?: number | null;
  fallbackConfidence?: number | null;
  onCreateRequest?: () => void;
}) {
  if (!recommendations.length && !diagnosis && !fallbackCost && !fallbackConfidence) return null;
  const isManualReview = diagnosis?.analysis_available === false || diagnosis?.status === 'MANUAL_REVIEW_REQUIRED';
  if (isManualReview) {
    return (
      <section className="diagnostic-summary" aria-label="Статус интеллектуального анализа">
        <header>
          <h3>Интеллектуальный анализ</h3>
          <UrgencyBadge urgency="medium" />
        </header>
        <p>
          {diagnosis?.summary ||
            'Интеллектуальный анализ временно недоступен. Введённые данные сохранены. Вы можете повторить анализ или передать обращение менеджеру.'}
        </p>
        <p className="analysis-disclaimer">
          Статус: ручная обработка. {diagnosis?.reason ? `Причина: ${diagnosis.reason}. ` : ''}
          {diagnosis?.execution_meta?.provider ? `Источник: ${diagnosis.execution_meta.provider}.` : ''}
        </p>
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
  const isCritical = String(diagnosis?.urgency || top?.urgency || '').toLowerCase() === 'critical';
  const diagnosisChecks = Array.isArray(diagnosis?.recommended_checks)
    ? diagnosis.recommended_checks
    : [];
  const checksFromRecs = recommendations.flatMap((item) => item.checks || []).filter(Boolean);
  const allChecks = diagnosisChecks.length ? diagnosisChecks : checksFromRecs;
  const obdItems = detail?.flowState?.obd_interpretations || [];

  return (
    <section className="diagnostic-summary" aria-label="Предварительный результат анализа">
      <header>
        <h3>Предварительный результат анализа</h3>
        <UrgencyBadge urgency={diagnosis?.urgency || top?.urgency} />
      </header>
      {isCritical ? <CriticalSafetyBanner /> : null}
      <p>{summaryText || 'Результат сформируется после уточнения ключевых параметров обращения.'}</p>
      <div className="analysis-grid">
        <ConfidenceIndicator value={confidence} />
        <EstimatedPriceCard amount={diagnosis?.estimated_cost_from ?? top?.costFromMinor ?? fallbackCost} />
      </div>
      <ObdCodesSummary items={obdItems} />
      <PossibleCausesList recommendations={recommendations} overallConfidence={diagnosis?.confidence} />
      <MasterChecksChecklist checks={allChecks} />
      <DiagnosisActions detail={detail ?? null} onCreateRequest={onCreateRequest} />
      <p className="analysis-disclaimer">
        {diagnosis?.execution_meta?.provider ? `Источник: ${diagnosis.execution_meta.provider}. ` : ''}
        {detail?.flowState?.photo_observations?.disclaimer ? `${detail.flowState.photo_observations.disclaimer} ` : ''}
        {diagnosis?.disclaimer ||
          'Результат сформирован на основе предоставленных данных и не заменяет техническую диагностику автомобиля специалистом.'}
      </p>
    </section>
  );
}
