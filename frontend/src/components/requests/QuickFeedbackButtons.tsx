import { useState } from 'react';
import { upsertConsultationFeedback } from '../../api/dashboard';
import { toFeedbackPayload } from '../../lib/consultationFeedbackPayload';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import type { ConsultationFeedback, ConsultationFeedbackVerdict } from '../../types/serviceRequest';

const OPTIONS: Array<{ id: ConsultationFeedbackVerdict; label: string }> = [
  { id: 'CORRECT', label: 'Верный' },
  { id: 'PARTIAL', label: 'Частично' },
  { id: 'INCORRECT', label: 'Неверный' },
];

type Props = {
  requestId: string;
  initial?: ConsultationFeedback | null;
  onSaved?: (feedback: ConsultationFeedback) => void;
  compact?: boolean;
};

export function QuickFeedbackButtons({ requestId, initial, onSaved, compact = false }: Props) {
  const [verdict, setVerdict] = useState<ConsultationFeedbackVerdict | null>(initial?.verdict ?? null);
  const [actualCause, setActualCause] = useState(initial?.actualCause ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsCause = verdict === 'PARTIAL' || verdict === 'INCORRECT';

  async function save(nextVerdict: ConsultationFeedbackVerdict, cause?: string) {
    if (nextVerdict !== 'CORRECT' && !cause?.trim()) {
      setVerdict(nextVerdict);
      setError('Укажите реальную причину');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = toFeedbackPayload(initial, {
        verdict: nextVerdict,
        actualCause: cause?.trim() || '',
      });
      if (!payload) {
        setError('Не удалось сохранить');
        return;
      }
      const saved = await upsertConsultationFeedback(requestId, payload);
      setVerdict(saved.verdict);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`quick-feedback${compact ? ' is-compact' : ''}`} aria-label="Быстрая оценка диагноза">
      {compact ? null : (
        <header>
          <h3>Оценка ИИ</h3>
        </header>
      )}
      <div className="feedback-verdict-row" role="group" aria-label="Оценка диагноза">
        {OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={verdict === option.id ? 'primary' : 'secondary'}
            className="feedback-verdict-btn"
            aria-pressed={verdict === option.id}
            disabled={saving}
            onClick={() => {
              if (option.id === 'CORRECT') {
                void save('CORRECT');
              } else {
                setVerdict(option.id);
                setError(null);
              }
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {needsCause ? (
        <div className="quick-feedback-cause stack gap-xs">
          <label>
            <span>Реальная причина *</span>
            <Textarea
              value={actualCause}
              onChange={(e) => setActualCause(e.target.value)}
              placeholder="Например: износ тормозных дисков"
              rows={2}
            />
          </label>
          <Button
            type="button"
            disabled={saving || !actualCause.trim()}
            onClick={() => verdict && void save(verdict, actualCause)}
          >
            {saving ? 'Сохранение…' : 'Сохранить оценку'}
          </Button>
        </div>
      ) : null}
      {initial?.updatedAt ? (
        <p className="muted">
          Сохранено: {new Date(initial.updatedAt).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {initial.manager?.fullName ? `, ${initial.manager.fullName}` : ''}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
