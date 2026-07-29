import type { LucideIcon } from 'lucide-react';

export function AnalyticsMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'warning' | 'success' | 'accent';
}) {
  return (
    <article className={`metric-card is-${tone}`}>
      <div className="metric-card-head">
        {Icon ? (
          <span className="metric-card-icon" aria-hidden>
            <Icon size={16} />
          </span>
        ) : null}
        <h4>{label}</h4>
      </div>
      <p>{value}</p>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
