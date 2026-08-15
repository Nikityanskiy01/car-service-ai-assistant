export const CONSULT_STAGE_LABELS: Record<string, string> = {
  INITIAL: 'Уточняем автомобиль и симптомы',
  COLLECTING_VEHICLE: 'Собираем данные об автомобиле',
  COLLECTING_SYMPTOMS: 'Уточняем основной симптом',
  CLARIFYING: 'Собираем уточнения для анализа',
  READY_FOR_ANALYSIS: 'Данные собраны, готовим запуск анализа',
  ANALYZING: 'Выполняем интеллектуальный анализ',
  COMPLETED: 'Анализ завершён. Можно создать заявку или задать вопрос.',
  MANUAL_REVIEW_REQUIRED: 'Анализ недоступен. Можно передать обращение менеджеру.',
  FAILED: 'Не удалось завершить анализ. Попробуйте повторить.',
};

export function localizeConsultStreamError(payload: unknown): string {
  const p = (payload || {}) as { message?: string; code?: string };
  if (String(p.code || '').toUpperCase() === 'LLM_ERROR') {
    return 'Сервис интеллектуального анализа временно недоступен. Вы можете сохранить обращение и передать его менеджеру.';
  }
  if (String(p.code || '').toUpperCase() === 'STREAM_ABORTED') {
    return 'Соединение с потоком ответа прервано. Попробуйте отправить сообщение ещё раз.';
  }
  const message = String(p.message || '').trim();
  const raw = message.toLowerCase();
  if (!raw) return 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
  if (raw.includes('aborted') || raw.includes('timeout')) {
    return 'Не удалось получить ответ интеллектуального ассистента вовремя. Введённые данные сохранены. Повторите запрос или передайте обращение менеджеру.';
  }
  if (/[A-Za-z]/.test(message) && !/[А-Яа-яЁё]/.test(message)) {
    return 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
  }
  return message;
}

export function localizeConsultThrownError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const low = raw.toLowerCase();
  if (low.includes('aborted') || low.includes('timeout')) {
    return 'Не удалось получить ответ интеллектуального ассистента вовремя. Введённые данные сохранены. Повторите запрос или передайте обращение менеджеру.';
  }
  if (low.includes('failed to fetch') || low.includes('network')) {
    return 'Нет подключения к серверу. Проверьте соединение и повторите попытку.';
  }
  if (/[A-Za-z]/.test(raw) && !/[А-Яа-яЁё]/.test(raw)) {
    return 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
  }
  return raw || 'Не удалось обработать сообщение. Попробуйте повторить отправку.';
}
