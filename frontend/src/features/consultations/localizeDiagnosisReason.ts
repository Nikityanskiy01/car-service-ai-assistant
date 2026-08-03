const REASON_LABELS: Record<string, string> = {
  INSUFFICIENT_DATA: 'недостаточно данных для автоматического анализа',
  LLM_UNAVAILABLE: 'сервис анализа временно недоступен',
  LLM_VALIDATION_FAILED: 'не удалось обработать ответ анализа',
  LLM_ERROR: 'ошибка при выполнении анализа',
};

/** Человекочитаемая причина ручной обработки (без технических кодов). */
export function localizeDiagnosisReason(reason?: string | null): string | null {
  if (!reason) return null;
  const key = String(reason).trim().toUpperCase();
  return REASON_LABELS[key] ?? null;
}

export function formatManualReviewHint(reason?: string | null): string {
  const localized = localizeDiagnosisReason(reason);
  if (localized) return localized.charAt(0).toUpperCase() + localized.slice(1) + '.';
  return 'Менеджер проверит обращение вручную.';
}
