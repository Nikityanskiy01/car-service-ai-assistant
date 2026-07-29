type Props = {
  progressPercent?: number | null;
  hasDiagnosis?: boolean;
  messageCount?: number;
};

export function ConsultationStagesTimeline({ progressPercent, hasDiagnosis, messageCount = 0 }: Props) {
  const stages = [
    { id: 'collect', label: 'Сбор данных', done: messageCount > 0 },
    { id: 'analyze', label: 'Анализ', done: (progressPercent ?? 0) >= 50 },
    { id: 'result', label: 'Результат', done: Boolean(hasDiagnosis) },
  ];

  return (
    <ol className="consultation-stages-timeline">
      {stages.map((stage, index) => (
        <li key={stage.id} className={stage.done ? 'is-done' : ''}>
          <span className="stage-index">{index + 1}</span>
          <span>{stage.label}</span>
        </li>
      ))}
    </ol>
  );
}
