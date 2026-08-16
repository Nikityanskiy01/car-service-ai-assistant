import { useEffect, useState } from 'react';
import { upsertConsultationFeedback } from '../../api/dashboard';
import { toFeedbackPayload } from '../../lib/consultationFeedbackPayload';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { HintTooltip } from '../manager/help/HintLabel';
import type { ConsultationFeedback, ConsultationFeedbackVerdict } from '../../types/serviceRequest';

const VERDICT_OPTIONS: Array<{ id: ConsultationFeedbackVerdict; label: string; hint: string }> = [
  { id: 'CORRECT', label: 'Верный', hint: 'ИИ попал в основную причину' },
  { id: 'PARTIAL', label: 'Частично', hint: 'Направление верное, но детали неточны' },
  { id: 'INCORRECT', label: 'Неверный', hint: 'Диагноз не соответствует реальности' },
];

const CATEGORY_OPTIONS = [
  { id: 'oil_change', label: 'Замена масла' },
  { id: 'maintenance', label: 'Плановое ТО' },
  { id: 'brakes', label: 'Тормоза' },
  { id: 'filters', label: 'Фильтры' },
  { id: 'tires', label: 'Шины' },
  { id: 'other', label: 'Прочее' },
] as const;

const VERDICT_LABEL: Record<ConsultationFeedbackVerdict, string> = {
  CORRECT: 'верный',
  PARTIAL: 'частично верный',
  INCORRECT: 'неверный',
};

type Props = {
  requestId: string;
  initial?: ConsultationFeedback | null;
  onSaved?: (feedback: ConsultationFeedback) => void;
  variant: 'evaluation' | 'works';
  onNeedEvaluation?: () => void;
};

export function ConsultationFeedbackPanel({
  requestId,
  initial,
  onSaved,
  variant,
  onNeedEvaluation,
}: Props) {
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
  const [repairMileageKm, setRepairMileageKm] = useState(
    initial?.repairMileageKm != null ? String(initial.repairMileageKm) : '',
  );
  const [workCategory, setWorkCategory] = useState<string>(initial?.workCategory || 'other');
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
    setRepairMileageKm(initial?.repairMileageKm != null ? String(initial.repairMileageKm) : '');
    setWorkCategory(initial?.workCategory || 'other');
    setSavedAt(initial?.updatedAt ?? null);
  }, [initial]);

  const needsCause = verdict === 'PARTIAL' || verdict === 'INCORRECT';
  const hasVerdict = Boolean(verdict || initial?.verdict);
  const isEvaluation = variant === 'evaluation';

  async function handleSave() {
    if (isEvaluation && !verdict) {
      setError('Выберите оценку диагноза');
      return;
    }
    if (isEvaluation && needsCause && !actualCause.trim()) {
      setError('Укажите реальную причину');
      return;
    }
    const payload = toFeedbackPayload(
      initial,
      isEvaluation
        ? { verdict, actualCause }
        : {
            worksDone,
            repairAmountRub,
            workOrderNumber,
            repairCompletedAt,
            repairMileageKm,
            workCategory,
          },
    );
    if (!payload) {
      setError('Сначала оцените диагноз ИИ на вкладке «Диалог ИИ»');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertConsultationFeedback(requestId, payload);
      setSavedAt(saved.updatedAt);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEvaluation ? 'Не удалось сохранить оценку' : 'Не удалось сохранить работы');
    } finally {
      setSaving(false);
    }
  }

  if (isEvaluation) {
    return (
      <section className="consultation-feedback-panel stack">
        <header>
          <h3>Оценка диагноза ИИ</h3>
          <p className="muted">
            Насколько предварительный диагноз совпал с тем, что подтвердилось в сервисе.
          </p>
        </header>

        <div className="feedback-verdict-row" role="group" aria-label="Оценка диагноза">
          {VERDICT_OPTIONS.map((option) => (
            <HintTooltip key={option.id} hint={option.hint}>
              <Button
                type="button"
                variant={verdict === option.id ? 'primary' : 'secondary'}
                className="feedback-verdict-btn"
                aria-pressed={verdict === option.id}
                onClick={() => setVerdict(option.id)}
              >
                {option.label}
              </Button>
            </HintTooltip>
          ))}
        </div>

        <label className="stack gap-xs">
          <span>Реальная причина{needsCause ? ' *' : ''}</span>
          <Textarea
            value={actualCause}
            onChange={(e) => setActualCause(e.target.value)}
            placeholder="Например: износ тормозных дисков спереди"
            rows={3}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        {savedAt && initial?.verdict ? (
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

  return (
    <section className="consultation-feedback-panel stack">
      <header>
        <h3>Выполненные работы</h3>
        <p className="muted">Что сделали по факту. Итог попадёт в сервисную книжку клиента.</p>
      </header>

      {!hasVerdict ? (
        <p className="request-works-eval-hint">
          Оценку диагноза ИИ ставят на вкладке «Диалог ИИ», рядом с перепиской ассистента.
          {onNeedEvaluation ? (
            <>
              {' '}
              <button type="button" className="request-inline-link" onClick={onNeedEvaluation}>
                Открыть диалог
              </button>
            </>
          ) : null}
        </p>
      ) : initial?.verdict ? (
        <p className="muted">
          Диагноз ИИ отмечен как {VERDICT_LABEL[initial.verdict]}.
          {onNeedEvaluation ? (
            <>
              {' '}
              <button type="button" className="request-inline-link" onClick={onNeedEvaluation}>
                Изменить оценку
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <label className="stack gap-xs">
        <span>Выполненные работы</span>
        <Textarea
          value={worksDone}
          onChange={(e) => setWorksDone(e.target.value)}
          placeholder="Замена дисков и колодок, балансировка"
          rows={3}
        />
      </label>

      <section className="repair-outcome-fields">
        <h4>Итог ремонта</h4>
        <div className="repair-outcome-grid">
          <label className="stack gap-xs">
            <span>Тип работ</span>
            <select className="select" value={workCategory} onChange={(e) => setWorkCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="stack gap-xs">
            <span>Пробег, км</span>
            <input
              className="input"
              type="number"
              min={0}
              value={repairMileageKm}
              onChange={(e) => setRepairMileageKm(e.target.value)}
              placeholder="45200"
            />
          </label>
          <label className="stack gap-xs">
            <span>Сумма, ₽</span>
            <input
              className="input"
              type="number"
              min={0}
              value={repairAmountRub}
              onChange={(e) => setRepairAmountRub(e.target.value)}
              placeholder="15000"
            />
          </label>
          <label className="stack gap-xs">
            <span>Заказ-наряд</span>
            <input
              className="input"
              type="text"
              value={workOrderNumber}
              onChange={(e) => setWorkOrderNumber(e.target.value)}
              placeholder="ЗН-0042"
            />
          </label>
          <label className="stack gap-xs">
            <span>Дата</span>
            <input
              className="input"
              type="date"
              value={repairCompletedAt}
              onChange={(e) => setRepairCompletedAt(e.target.value)}
            />
          </label>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {savedAt && initial?.worksDone ? (
        <p className="muted">Сохранено: {new Date(savedAt).toLocaleString('ru-RU')}</p>
      ) : null}

      <div>
        <Button type="button" disabled={saving || !hasVerdict} onClick={() => void handleSave()}>
          {saving ? 'Сохранение…' : 'Сохранить работы'}
        </Button>
      </div>
    </section>
  );
}
