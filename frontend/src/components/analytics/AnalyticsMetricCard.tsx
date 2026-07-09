export function AnalyticsMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <article className="metric-card">
      <h4>{label}</h4>
      <p>{value}</p>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
