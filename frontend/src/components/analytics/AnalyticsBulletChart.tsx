type Props = {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  hint?: string;
};

export function AnalyticsBulletChart({ label, value, max, suffix = '', hint }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="analytics-bullet" title={hint}>
      <div className="analytics-bullet-head">
        <span>{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </div>
      <div className="analytics-bullet-track" aria-hidden>
        <div className="analytics-bullet-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
