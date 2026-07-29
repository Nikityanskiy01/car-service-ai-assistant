import { useEffect, useState } from 'react';
import { upsertConsultationFeedback } from '../../api/dashboard';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import type { ConsultationFeedback, ConsultationFeedbackVerdict } from '../../types/serviceRequest';

const VERDICT_OPTIONS: Array<{ id: ConsultationFeedbackVerdict; label: string; hint: string }> = [
  { id: 'CORRECT', label: 'Верный', hint: 'ИИ попал в основную причину' },
  { id: 'PARTIAL', label: 'Частично', hint: 'Направление верное, но детали неточны' },
  { id: 'INCORRECT', label: 'Неверный', hint: 'Диагноз не соответствует реальности' },
];

type Props = {
  requestId: string;
  initial?: ConsultationFeedback | null;
  onSaved?: (feedback: ConsultationFeedback) => void;
};

export function ConsultationFeedbackPanel({ requestId, initial, onSaved }: Props) {
  const [verdict, setVerdict] = useState<ConsultationFeedbackVerdict | null>(initial?.verdict ?? null);
  const [actualCause, setActualCause] = useState(initial?.actualCause ?? '');
  const [worksDone, setWorksDone] = useState(initial?.worksDone ?? '');
  const [repairAmountRub, setRepairAmountRub] = useState(
    initial?.repairAmountMinor != null ? String(Math.round(initial.repairAmountMinor / 100)) : '',
  );
  const [workOrderNumber, setWorkOrderNumber] = useState(initial?.workOrderNumber ?? '');
  const [repairCompletedAt, setRepairCompletedAt] = useState(
    initial?.repairCompletedAt ? initial.repairCompletedAt.slice(0, 10) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null);

  useEffect(() => {
    setVerdict(initial?.verdict ?? null);
    setActualCause(initial?.actualCause ?? '');
    setWorksDone(initial?.worksDone ?? '');
    setRepairAmountRub(
      initial?.repairAmountMinor != null ? String(Math.round(initial.repairAmountMinor / 100)) : '',
    );
    setWorkOrderNumber(initial?.workOrderNumber ?? '');
    setRepairCompletedAt(initial?.repairCompletedAt ? initial.repairCompletedAt.slice(0, 10) : '');
    setSavedAt(initial?.updatedAt ?? null);
  }, [initial]);

  const needsCause = verdict === 'PARTIAL' || verdict === 'INCORRECT';

  async function handleSave() {
    if (!verdict) {
      setError('Выберите оценку диагноза');
      return;
    }
    if (needsCause && !actualCause.trim()) {
      setError('Укажите реальную причину');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertConsultationFeedback(requestId, {
        verdict,
        actualCause: actualCause.trim() || undefined,
        worksDone: worksDone.trim() || undefined,
        repairAmountMinor: repairAmountRub.trim()
          ? Math.round(Number(repairAmountRub) * 100)
          : null,
        workOrderNumber: workOrderNumber.trim() || null,
        repairCompletedAt: repairCompletedAt ? new Date(repairCompletedAt).toISOString() : null,
      });
      setSavedAt(saved.updatedAt);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить оценку');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="consultation-feedback-panel stack">
      <header>
        <h3>Оценка диагноза ИИ</h3>
        <p className="muted">
          Помогите улучшить рекомендации: отметьте, насколько предварительный диагноз совпал с реальностью.
        </p>
      </header>

      <div className="feedback-verdict-row" role="group" aria-label="Оценка диагноза">
        {VERDICT_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={verdict === option.id ? 'primary' : 'secondary'}
            className="feedback-verdict-btn"
            title={option.hint}
            aria-pressed={verdict === option.id}
            onClick={() => setVerdict(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <label className="stack gap-xs">
        <span>Реальная причина{needsCause ? ' *' : ''}</span>
        <Textarea
          value={actualCause}
          onChange={(e) => setActualCause(e.target.value)}
          placeholder="Например: износ тормозных дисков спереди"
          rows={2}
        />
      </label>

      <label className="stack gap-xs">
        <span>Выполненные работы</span>
        <Textarea
          value={worksDone}
          onChange={(e) => setWorksDone(e.target.value)}
          placeholder="Замена дисков и колодок, балансировка"
          rows={2}
        />
      </label>

      <section className="repair-outcome-fields">
        <h4>Итог ремонта</h4>
        <div className="repair-outcome-grid">
          <label className="stack gap-xs">
            <span>Сумма, ₽</span>
            <input
              type="number"
              min={0}
              value={repairAmountRub}
              onChange={(e) => setRepairAmountRub(e.target.value)}
              placeholder="15000"
            />
          </label>
          <label className="stack gap-xs">
            <span>№ заказ-наряда</span>
            <input
              type="text"
              value={workOrderNumber}
              onChange={(e) => setWorkOrderNumber(e.target.value)}
              placeholder="ЗН-0042"
            />
          </label>
          <label className="stack gap-xs">
            <span>Дата завершения</span>
            <input
              type="date"
              value={repairCompletedAt}
              onChange={(e) => setRepairCompletedAt(e.target.value)}
            />
          </label>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {savedAt ? (
        <p className="muted">
          Сохранено: {new Date(savedAt).toLocaleString('ru-RU')}
          {initial?.manager?.fullName ? ` · ${initial.manager.fullName}` : ''}
        </p>
      ) : null}

      <div>
        <Button type="button" disabled={saving || !verdict} onClick={() => void handleSave()}>
          {saving ? 'Сохранение…' : 'Сохранить оценку'}
        </Button>
      </div>
    </section>
  );
}
