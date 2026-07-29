import type { ConsultationExtractedData } from '../../types/consultation';
import { consultationPhaseLabel } from '../../features/consultations/phaseLabels';
import { VehicleDataChips } from './CollectedVehicleData';

const STAGES = [
  { key: 'COLLECTING_VEHICLE', label: 'Авто' },
  { key: 'COLLECTING_SYMPTOMS', label: 'Симптом' },
  { key: 'CLARIFYING', label: 'Уточнения' },
  { key: 'COMPLETED', label: 'Результат' },
] as const;

function stageIndex(stage: string): number {
  if (stage === 'INITIAL' || stage === 'COLLECTING_VEHICLE') return 0;
  if (stage === 'COLLECTING_SYMPTOMS') return 1;
  if (stage === 'CLARIFYING' || stage === 'READY_FOR_ANALYSIS') return 2;
  if (stage === 'ANALYZING' || stage === 'COMPLETED' || stage === 'MANUAL_REVIEW_REQUIRED' || stage === 'FAILED') {
    return 3;
  }
  return 0;
}

function stageBadge(stage: string): string {
  if (stage === 'COMPLETED') return 'Готово';
  if (stage === 'ANALYZING') return 'Анализ';
  if (stage === 'CLARIFYING' || stage === 'READY_FOR_ANALYSIS') return 'Уточнение';
  if (stage === 'COLLECTING_SYMPTOMS') return 'Симптомы';
  return 'Сбор данных';
}

export function ConsultationProgress({
  progress,
  phase,
  stage = 'INITIAL',
  statusText,
  extracted,
}: {
  progress: number;
  phase: string | null;
  stage?: string;
  statusText?: string;
  extracted?: ConsultationExtractedData | null;
}) {
  const normalized = Math.max(0, Math.min(100, progress));
  const active = stageIndex(stage);
  const phaseLabel = phase ? consultationPhaseLabel(phase) : '';
  const footerText = phaseLabel || statusText || 'Уточняем автомобиль и симптомы';

  return (
    <section className="progress-panel" aria-label="Прогресс консультации">
      <div className="progress-head">
        <h3>Этап консультации</h3>
        <span className="consult-stage-badge">{stageBadge(stage)}</span>
      </div>

      <ol className="consult-stage-steps">
        {STAGES.map((item, index) => (
          <li key={item.key} className={index <= active ? 'is-active' : undefined} aria-current={index === active ? 'step' : undefined}>
            <span>{index + 1}</span>
            <small>{item.label}</small>
          </li>
        ))}
      </ol>

      <p className="consult-stage-status">{footerText}</p>

      <div className="progress-head compact">
        <span>Прогресс</span>
        <strong>{normalized}%</strong>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}>
        <span style={{ width: `${normalized}%` }} />
      </div>

      <VehicleDataChips data={extracted} />
    </section>
  );
}
