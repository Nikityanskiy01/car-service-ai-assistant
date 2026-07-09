import type { ConsultationRecommendation } from '../../types/consultation';

export function RecommendedChecks({ recommendations }: { recommendations: ConsultationRecommendation[] }) {
  const checks = recommendations.flatMap((item) => item.checks || []).filter(Boolean);
  if (!checks.length) return null;
  return (
    <section className="analysis-list">
      <h4>Рекомендуемые проверки</h4>
      <ul>
        {checks.slice(0, 6).map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
    </section>
  );
}
