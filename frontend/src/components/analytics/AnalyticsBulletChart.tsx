type Props = {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  hint?: string;
  empty?: boolean;
};

export function AnalyticsBulletChart({ label, value, max, suffix = '', hint, empty = false }: Props) {
  const pct = empty || max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="analytics-bullet" title={hint}>
      <div className="analytics-bullet-head">
        <span>{label}</span>
        <strong>{empty ? '—' : `${value}${suffix}`}</strong>
      </div>
      <div className="analytics-bullet-track" aria-hidden>
        <div className="analytics-bullet-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
