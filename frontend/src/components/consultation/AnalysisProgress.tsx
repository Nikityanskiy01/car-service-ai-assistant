import { useEffect, useState } from 'react';
import { activeConsultationStepIndex, consultationPhaseLabel, CONSULTATION_PHASE_STEPS } from '../../features/consultations/phaseLabels';

export function AnalysisProgress({ phase, online }: { phase: string | null; online: boolean }) {
  const [isSlow, setIsSlow] = useState(false);
  const activeStep = activeConsultationStepIndex(phase);

  useEffect(() => {
    setIsSlow(false);
    if (!phase) return;
    const timer = window.setTimeout(() => setIsSlow(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (!phase) return null;

  return (
    <section className="analysis-progress" aria-live="polite" aria-label="Ход интеллектуального анализа">
      {!online ? (
        <p>Интернет пропал — дождитесь восстановления сети, затем отправьте сообщение снова.</p>
      ) : null}
      {phase ? (
        <>
          <ol className="analysis-phase-steps">
            {CONSULTATION_PHASE_STEPS.map((step, index) => {
              const state =
                activeStep < 0 ? 'pending' : index < activeStep ? 'done' : index === activeStep ? 'active' : 'pending';
              return (
                <li key={step.id} className={`analysis-phase-step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
                  <span className="analysis-phase-step-num">{index + 1}</span>
                  <span className="analysis-phase-step-label">{step.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="analysis-phase-detail">{consultationPhaseLabel(phase)}</p>
        </>
      ) : null}
      {phase && isSlow ? <p className="analysis-phase-slow">Анализ занимает больше времени, чем обычно. Соединение сохраняется.</p> : null}
    </section>
  );
}
