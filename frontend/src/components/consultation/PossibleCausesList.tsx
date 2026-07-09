import type { ConsultationRecommendation } from '../../types/consultation';

export function PossibleCausesList({ recommendations }: { recommendations: ConsultationRecommendation[] }) {
  if (!recommendations.length) return null;
  return (
    <section className="analysis-list">
      <h4>Возможные причины</h4>
      <ul>
        {recommendations.slice(0, 5).map((item, index) => (
          <li key={`${item.title || item.summary || index}`}>
            <span>{item.title || item.summary || 'Неопределенная причина'}</span>
            <small>
              {typeof item.probabilityPercent === 'number'
                ? `${item.probabilityPercent}%`
                : item.confidence
                  ? `${Math.round(item.confidence * 100)}%`
                  : '—'}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}
