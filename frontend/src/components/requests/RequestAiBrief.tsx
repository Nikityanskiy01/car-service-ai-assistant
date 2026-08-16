import { PossibleCausesList } from '../consultation/PossibleCausesList';
import type { ConsultationRecommendation } from '../../types/consultation';

type Props = {
  recommendations: ConsultationRecommendation[];
  overallConfidence?: number | null;
  summary?: string;
};

export function RequestAiBrief({ recommendations, overallConfidence, summary }: Props) {
  if (!recommendations.length && !summary) return null;

  return (
    <section className="request-ai-brief" aria-labelledby="request-ai-brief-title">
      <header>
        <h2 id="request-ai-brief-title">Предварительный диагноз</h2>
        <p>Гипотезы по симптомам. Оценку ставят после проверки в сервисе.</p>
      </header>
      <PossibleCausesList
        recommendations={recommendations}
        overallConfidence={overallConfidence}
        variant="staff"
      />
      {summary ? (
        <details className="request-ai-note">
          <summary>Почему так</summary>
          <p>{summary}</p>
        </details>
      ) : null}
    </section>
  );
}
