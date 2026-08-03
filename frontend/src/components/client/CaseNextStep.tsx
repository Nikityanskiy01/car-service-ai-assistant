import {
  CalendarCheck2,
  CircleCheck,
  CircleOff,
  Hourglass,
  MessageSquare,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type {
  CaseNextStepCta,
  CaseNextStepIcon,
  CaseNextStepModel,
} from '../../features/client-cases/resolveCaseNextStep';

const ICONS: Record<CaseNextStepIcon, LucideIcon> = {
  sparkles: Sparkles,
  hourglass: Hourglass,
  wrench: Wrench,
  calendar: CalendarCheck2,
  check: CircleCheck,
  off: CircleOff,
};

type Props = {
  model: CaseNextStepModel;
  onAction: (action: CaseNextStepCta['action']) => void;
  className?: string;
  /** Скрыть кнопки — если дублируются sticky-баром на мобильном */
  showActions?: boolean;
};

function actionIcon(action: CaseNextStepCta['action']): LucideIcon | null {
  if (action === 'write_message') return MessageSquare;
  if (action === 'book_visit' || action === 'open_visit') return CalendarCheck2;
  return null;
}

function ActionButton({
  cta,
  onAction,
  emphasis,
}: {
  cta: CaseNextStepCta;
  onAction: (action: CaseNextStepCta['action']) => void;
  emphasis: 'primary' | 'secondary';
}) {
  const Icon = actionIcon(cta.action);

  return (
    <button
      type="button"
      className={`case-next-cta is-${emphasis}`}
      onClick={() => onAction(cta.action)}
    >
      {Icon ? <Icon size={17} strokeWidth={2.2} aria-hidden /> : null}
      <span>{cta.label}</span>
    </button>
  );
}

export function CaseNextStep({ model, onAction, className = '', showActions = true }: Props) {
  const Icon = ICONS[model.icon];

  return (
    <section
      className={`case-next-step ${className}`.trim()}
      data-tone={model.tone}
      aria-label="Что дальше"
    >
      <div className="case-next-step-icon" aria-hidden>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <div className="case-next-step-copy">
        <span className="case-next-step-kicker">Что дальше</span>
        <p className="case-next-step-now-text">{model.nowLabel}</p>
        {model.yourStepLabel ? (
          <p className="case-next-step-yours">{model.yourStepLabel}</p>
        ) : null}
      </div>
      {showActions ? (
        <div className="case-next-step-actions">
          <ActionButton cta={model.primary} onAction={onAction} emphasis="primary" />
          {model.secondary ? (
            <ActionButton cta={model.secondary} onAction={onAction} emphasis="secondary" />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
