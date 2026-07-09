export function ConfidenceIndicator({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <section className="confidence-indicator" aria-label="Уровень уверенности">
      <header>
        <h4>Уверенность анализа</h4>
        <strong>{normalized}%</strong>
      </header>
      <div className="progress-track compact">
        <span style={{ width: `${normalized}%` }} />
      </div>
      <small>Показатель отражает степень полноты данных, а не окончательный диагноз.</small>
    </section>
  );
}
