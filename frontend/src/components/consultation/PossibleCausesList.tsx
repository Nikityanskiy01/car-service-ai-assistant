import { useState } from 'react';
import type { ConsultationRecommendation } from '../../types/consultation';

const TOP_N = 3;

function resolvePercent(item: ConsultationRecommendation, index: number, overallConfidence?: number | null): number | null {
  if (typeof item.probabilityPercent === 'number') {
    return Math.max(0, Math.min(100, item.probabilityPercent));
  }
  if (typeof item.confidence === 'number') {
    return Math.max(0, Math.min(100, Math.round(item.confidence * 100)));
  }
  if (typeof overallConfidence === 'number' && Number.isFinite(overallConfidence) && overallConfidence > 0) {
    return Math.max(12, Math.min(95, Math.round(overallConfidence * 100 - index * 10)));
  }
  return null;
}

function splitCause(title: string): { name: string; why: string | null } {
  const parts = title.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    return { name: parts[0].trim(), why: parts.slice(1).join('. ').trim() };
  }
  return { name: title, why: null };
}

export function PossibleCausesList({
  recommendations,
  overallConfidence,
  variant = 'default',
}: {
  recommendations: ConsultationRecommendation[];
  overallConfidence?: number | null;
  variant?: 'default' | 'staff';
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isStaff = variant === 'staff';
  const items = recommendations
    .filter((item) => {
      const title = String(item.title || item.summary || '').trim();
      return title.length > 0 && !/^неопредел/i.test(title);
    })
    .slice(0, TOP_N);
  if (!items.length) return null;

  if (isStaff) {
    return (
      <ol className="request-cause-rank" aria-label="Вероятные причины">
        {items.map((item, index) => {
          const percent = resolvePercent(item, index, overallConfidence);
          const title = item.title || item.summary || '';
          const { name } = splitCause(title);
          return (
            <li key={`${title}-${index}`}>
              <span>{name}</span>
              {percent != null ? <strong className="tnum">{percent}%</strong> : null}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section className="analysis-list analysis-causes-ranked" aria-label="Наиболее вероятные причины">
      <h4>Наиболее вероятные причины</h4>
      <p className="cause-rank-hint">Нажмите на причину, чтобы увидеть пояснение простыми словами.</p>
      <ul>
        {items.map((item, index) => {
          const percent = resolvePercent(item, index, overallConfidence);
          const title = item.title || item.summary || '';
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
                <CauseHead index={index} name={name} percent={percent} />
                {percent != null ? (
                  <div className="progress-track compact cause-rank-bar" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                ) : null}
              </button>
              {expanded ? (
                <p className="cause-rank-why">
                  {why ||
                    'Это одна из типичных причин при описанных симптомах. Точный вывод возможен только после проверки в сервисе.'}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CauseHead({
  index,
  name,
  percent,
}: {
  index: number;
  name: string;
  percent: number | null;
}) {
  return (
    <div className="cause-rank-head">
      <span className="cause-rank-index">{index + 1}</span>
      <span className="cause-rank-title">{name}</span>
      {percent != null ? <strong className="cause-rank-percent">{percent}%</strong> : null}
    </div>
  );
}
