import { useEffect, useState } from 'react';

const PHASE_LABELS: Record<string, string> = {
  started: 'Отправляем сообщение',
  extracting: 'Сохраняем данные',
  extracted: 'Подготавливаем следующий шаг',
  diagnosing: 'Формируем результат интеллектуального анализа',
};

export function AnalysisProgress({ phase, online }: { phase: string | null; online: boolean }) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    setIsSlow(false);
    if (!phase) return;
    const timer = window.setTimeout(() => setIsSlow(true), 15_000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (!phase && online) return null;
  return (
    <section className="analysis-progress" aria-live="polite">
      {!online ? (
        <p>Нет подключения к сети. Сообщения будут отправлены после восстановления соединения.</p>
      ) : null}
      {phase ? <p>Интеллектуальный анализ: {PHASE_LABELS[phase] || phase}</p> : null}
      {phase && isSlow ? <p>Анализ занимает больше времени, чем обычно. Соединение сохраняется.</p> : null}
    </section>
  );
}
