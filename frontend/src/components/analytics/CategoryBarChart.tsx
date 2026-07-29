type Row = {
  label: string;
  value: number;
  meta?: string;
};

export function CategoryBarChart({ rows, max }: { rows: Row[]; max?: number }) {
  const peak = max ?? Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="category-bar-chart">
      {rows.map((row) => (
        <div key={row.label} className="category-bar-row">
          <div className="category-bar-label">
            <span>{row.label}</span>
            <strong>
              {row.value}
              {row.meta ? <small className="muted"> {row.meta}</small> : null}
            </strong>
          </div>
          <div className="category-bar-track" aria-hidden>
            <div className="category-bar-fill" style={{ width: `${Math.max(6, (row.value / peak) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
