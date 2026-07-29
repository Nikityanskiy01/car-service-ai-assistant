import { useState } from 'react';
import type { ConsultationRecommendation } from '../../types/consultation';

const TOP_N = 3;

function resolvePercent(item: ConsultationRecommendation, index: number, overallConfidence?: number | null): number {
  if (typeof item.probabilityPercent === 'number') {
    return Math.max(0, Math.min(100, item.probabilityPercent));
  }
  if (typeof item.confidence === 'number') {
    return Math.max(0, Math.min(100, Math.round(item.confidence * 100)));
  }
  if (typeof overallConfidence === 'number' && Number.isFinite(overallConfidence)) {
    return Math.max(12, Math.min(95, Math.round(overallConfidence * 100 - index * 10)));
  }
  return Math.max(20, 75 - index * 15);
}

function splitCause(title: string): { name: string; why: string | null } {
  const parts = title.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    return { name: parts[0].trim(), why: parts.slice(1).join(' — ').trim() };
  }
  return { name: title, why: null };
}

export function PossibleCausesList({
  recommendations,
  overallConfidence,
}: {
  recommendations: ConsultationRecommendation[];
  overallConfidence?: number | null;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = recommendations.slice(0, TOP_N);
  if (!items.length) return null;

  return (
    <section className="analysis-list analysis-causes-ranked" aria-label="Наиболее вероятные причины">
      <h4>Наиболее вероятные причины</h4>
      <p className="cause-rank-hint">Нажмите на причину, чтобы увидеть пояснение простыми словами.</p>
      <ul>
        {items.map((item, index) => {
          const percent = resolvePercent(item, index, overallConfidence);
          const title = item.title || item.summary || 'Неопределённая причина';
          const { name, why } = splitCause(title);
          const expanded = openIndex === index;
          return (
            <li key={`${title}-${index}`}>
              <button
                type="button"
                className="cause-rank-toggle"
                aria-expanded={expanded}
                onClick={() => setOpenIndex(expanded ? null : index)}
              >
                <div className="cause-rank-head">
                  <span className="cause-rank-index">{index + 1}</span>
                  <span className="cause-rank-title">{name}</span>
                  <strong className="cause-rank-percent">{percent}%</strong>
                </div>
                <div className="progress-track compact cause-rank-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
              </button>
              {expanded ? (
                <p className="cause-rank-why">
                  {why ||
                    'Это одна из типичных причин при описанных симптомах. Точный вывод возможен только после проверки на посту.'}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {recommendations.length > TOP_N ? (
        <p className="cause-rank-more">Ещё {recommendations.length - TOP_N} вариант(а) в полном отчёте.</p>
      ) : null}
    </section>
  );
}
