/** Этапы SSE-потока консультации → понятные подписи для UI. */
export const CONSULTATION_PHASE_STEPS = [
  { id: 'collect', phases: ['started', 'extracting', 'extracted'], label: 'Собираю данные' },
  { id: 'analyze', phases: ['analyzing_symptoms'], label: 'Анализирую симптомы' },
  { id: 'plan', phases: ['diagnosing', 'DIAGNOSIS_QUEUED'], label: 'Формирую план' },
] as const;

export const CONSULTATION_PHASE_LABELS: Record<string, string> = {
  started: 'Принимаем сообщение',
  extracting: 'Собираю данные',
  extracted: 'Данные сохранены',
  analyzing_symptoms: 'Анализирую симптомы',
  diagnosing: 'Формирую план работ',
  DIAGNOSIS_QUEUED: 'Интеллектуальный анализ в очереди',
};

export function consultationPhaseLabel(phase: string | null | undefined): string {
  if (!phase) return '';
  return CONSULTATION_PHASE_LABELS[phase] || phase;
}

export function activeConsultationStepIndex(phase: string | null | undefined): number {
  if (!phase) return -1;
  const idx = CONSULTATION_PHASE_STEPS.findIndex((step) =>
    (step.phases as readonly string[]).includes(phase),
  );
  if (idx >= 0) return idx;
  if (phase === 'diagnosing') return 2;
  if (phase === 'extracted') return 1;
  return 0;
}
