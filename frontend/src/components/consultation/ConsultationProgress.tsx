export function ConsultationProgress({
  progress,
  phase,
  statusText,
}: {
  progress: number;
  phase: string | null;
  statusText?: string;
}) {
  const normalized = Math.max(0, Math.min(100, progress));
  const footerText = phase ? `Текущий этап: ${phase}` : statusText || 'Ожидание следующего сообщения';
  return (
    <section className="progress-panel" aria-label="Прогресс консультации">
      <div className="progress-head">
        <h3>Прогресс консультации</h3>
        <strong>{normalized}%</strong>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}>
        <span style={{ width: `${normalized}%` }} />
      </div>
      <small>{footerText}</small>
    </section>
  );
}
