type ConsultationLabelSource = {
  id: string;
  make?: string | null;
  model?: string | null;
  symptoms?: string | null;
  extracted?: {
    make?: string | null;
    model?: string | null;
    symptoms?: string | null;
  } | null;
};

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function formatConsultationTitle(item: ConsultationLabelSource): string {
  const make = item.make ?? item.extracted?.make ?? null;
  const model = item.model ?? item.extracted?.model ?? null;
  const symptoms = item.symptoms ?? item.extracted?.symptoms ?? null;
  const vehicle = [make, model].filter(Boolean).join(' ');

  if (vehicle && symptoms) {
    return `${vehicle} — ${truncate(symptoms, 60)}`;
  }
  if (vehicle) return vehicle;
  if (symptoms) return truncate(symptoms, 80);
  return `Диагностика ${item.id.slice(0, 8).toUpperCase()}`;
}

export function formatConsultationSubtitle(progressPercent?: number | null): string {
  const progress = progressPercent ?? 0;
  if (progress >= 100) return 'Анализ завершён';
  if (progress > 0) return `Прогресс: ${progress}%`;
  return 'Диалог начат';
}
