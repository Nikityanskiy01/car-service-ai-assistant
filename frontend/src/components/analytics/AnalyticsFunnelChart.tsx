export type FunnelStep = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  steps: FunnelStep[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
};

export function AnalyticsFunnelChart({ steps, activeKey, onSelect }: Props) {
  const max = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="analytics-funnel">
      {steps.map((step, index) => {
        const width = Math.max(18, Math.round((step.count / max) * 100));
        const prev = index > 0 ? steps[index - 1].count : null;
        const drop =
          prev && prev > 0 ? Math.round(((prev - step.count) / prev) * 100) : null;
        const isActive = activeKey === step.key;

        return (
          <div key={step.key} className="analytics-funnel-row">
            {drop != null && index > 0 ? (
              <div className="analytics-funnel-drop">−{drop}%</div>
            ) : (
              <div className="analytics-funnel-drop is-empty" />
            )}
            <button
              type="button"
              className={`analytics-funnel-bar${isActive ? ' is-active' : ''}`}
              style={{ width: `${width}%` }}
              onClick={() => onSelect?.(step.key)}
            >
              <span className="analytics-funnel-label">{step.label}</span>
              <span className="analytics-funnel-value">{step.count}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
