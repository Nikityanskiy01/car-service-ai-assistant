import { Check, Circle, X } from 'lucide-react';

const STEPS = [
  { id: 'request', label: 'Запрос' },
  { id: 'confirm', label: 'Подтверждение' },
  { id: 'visit', label: 'Визит' },
] as const;

function resolveProgress(status: string): { index: number; cancelled: boolean; failed: boolean } {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'CANCELLED') return { index: -1, cancelled: true, failed: false };
  if (normalized === 'NO_SHOW') return { index: 2, cancelled: false, failed: true };
  if (normalized === 'ARRIVED') return { index: 3, cancelled: false, failed: false };
  if (normalized === 'CONFIRMED') return { index: 2, cancelled: false, failed: false };
  return { index: 1, cancelled: false, failed: false };
}

export function BookingStatusRail({ status }: { status: string }) {
  const { index, cancelled, failed } = resolveProgress(status);

  if (cancelled) {
    return (
      <div className="booking-status-rail is-cancelled" role="status">
        <X size={15} aria-hidden />
        <span>Запись отменена</span>
      </div>
    );
  }

  return (
    <ol className="booking-status-rail" aria-label="Этапы записи">
      {STEPS.map((step, stepIndex) => {
        const done = index > stepIndex + 1 || (index === 3 && stepIndex <= 2);
        const current = index === stepIndex + 1;
        const isFailed = failed && stepIndex === 2;
        return (
          <li
            key={step.id}
            className={`booking-status-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}${isFailed ? ' is-failed' : ''}`}
          >
            <span className="booking-status-marker" aria-hidden>
              {done ? <Check size={13} strokeWidth={2.5} /> : <Circle size={8} fill="currentColor" strokeWidth={0} />}
            </span>
            <span className="booking-status-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
