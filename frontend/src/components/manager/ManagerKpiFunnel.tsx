import type { ManagerKpi } from '../../api/dashboard';

type Props = {
  kpi: ManagerKpi;
};

export function ManagerKpiFunnel({ kpi }: Props) {
  const { funnel } = kpi;
  const max = Math.max(...funnel.steps.map((s) => s.count), 1);

  return (
    <section className="manager-funnel" aria-label="Воронка за период">
      <header className="funnel-header">
        <h2>Воронка за {kpi.periodDays} дн.</h2>
        {funnel.biggestDropOff ? (
          <p className="muted funnel-drop-hint">
            Наибольший отток: {funnel.biggestDropOff.from} → {funnel.biggestDropOff.to} (
            {funnel.biggestDropOff.dropPercent}%)
          </p>
        ) : null}
      </header>
      <div className="funnel-bars">
        {funnel.steps.map((step, index) => {
          const prev = index > 0 ? funnel.steps[index - 1].count : null;
          const conv =
            prev && prev > 0 ? Math.round((step.count / prev) * 100) : index === 0 ? 100 : 0;
          return (
            <div key={step.key} className="funnel-bar-row">
              <div className="funnel-bar-label">
                <span>{step.label}</span>
                <strong>{step.count}</strong>
              </div>
              <div className="funnel-bar-track" aria-hidden>
                <div
                  className="funnel-bar-fill"
                  style={{ width: `${Math.max(8, (step.count / max) * 100)}%` }}
                />
              </div>
              {index > 0 ? <span className="funnel-conv muted">{conv}%</span> : null}
            </div>
          );
        })}
      </div>
      <div className="funnel-conv-row muted">
        <span>Консультация → заявка: {funnel.conversionConsultationToRequest}%</span>
        <span>Заявка → запись: {funnel.conversionRequestToBooking}%</span>
        <span>Завершено: {funnel.conversionCompleted}%</span>
      </div>
    </section>
  );
}
