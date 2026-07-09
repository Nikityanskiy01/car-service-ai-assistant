import type { ConsultationRecommendation } from '../../types/consultation';
import type { ConsultationDiagnosisSnapshot } from '../../types/consultation';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { EstimatedPriceCard } from './EstimatedPriceCard';
import { PossibleCausesList } from './PossibleCausesList';
import { RecommendedChecks } from './RecommendedChecks';
import { UrgencyBadge } from './UrgencyBadge';

export function DiagnosticSummary({
  recommendations,
  diagnosis,
  fallbackCost,
  fallbackConfidence,
}: {
  recommendations: ConsultationRecommendation[];
  diagnosis?: ConsultationDiagnosisSnapshot | null;
  fallbackCost?: number | null;
  fallbackConfidence?: number | null;
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
  const diagnosisChecks = Array.isArray(diagnosis?.recommended_checks)
    ? diagnosis.recommended_checks
    : [];
  const mergedRecommendations = diagnosisChecks.length
    ? [{ checks: diagnosisChecks }]
    : recommendations;

  return (
    <section className="diagnostic-summary" aria-label="Предварительный результат анализа">
      <header>
        <h3>Предварительный результат анализа</h3>
        <UrgencyBadge urgency={diagnosis?.urgency || top?.urgency} />
      </header>
      <p>{summaryText || 'Результат сформируется после уточнения ключевых параметров обращения.'}</p>
      <div className="analysis-grid">
        <ConfidenceIndicator value={confidence} />
        <EstimatedPriceCard amount={diagnosis?.estimated_cost_from ?? top?.costFromMinor ?? fallbackCost} />
      </div>
      <PossibleCausesList recommendations={recommendations} />
      <RecommendedChecks recommendations={mergedRecommendations} />
      <p className="analysis-disclaimer">
        {diagnosis?.execution_meta?.provider ? `Источник: ${diagnosis.execution_meta.provider}. ` : ''}
        {diagnosis?.disclaimer ||
          'Результат сформирован на основе предоставленных данных и не заменяет техническую диагностику автомобиля специалистом.'}
      </p>
    </section>
  );
}
