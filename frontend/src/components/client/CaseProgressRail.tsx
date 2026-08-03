import type { ClientCaseDetailTab } from '../../features/client-cases/types';
import { buildCaseJourneySteps } from './CaseTimeline';
import type { ClientCase } from '../../features/client-cases/types';

type Props = {
  clientCase: ClientCase;
  requestCreatedAt?: string;
  bookingPreferredAt?: string;
  bookingStatus?: string;
  onStepClick?: (tab: ClientCaseDetailTab) => void;
};

const STEP_TAB: Record<string, ClientCaseDetailTab | null> = {
  diagnosis: 'diagnosis',
  service: 'messages',
  visit: 'booking',
  done: null,
};

export function CaseProgressRail({
  clientCase,
  requestCreatedAt,
  bookingPreferredAt,
  bookingStatus,
  onStepClick,
}: Props) {
  const steps = buildCaseJourneySteps({
    clientCase,
    requestCreatedAt,
    bookingPreferredAt,
    bookingStatus,
  });

  return (
    <nav className="case-progress-rail" aria-label="Этапы обращения">
      <ol className="case-progress-rail-track">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const tabTarget = STEP_TAB[step.id];
          const clickable = Boolean(onStepClick && tabTarget);

          return (
            <li
              key={step.id}
              className={`case-progress-rail-step is-${step.state}${clickable ? ' is-clickable' : ''}`}
            >
              {index > 0 ? <span className="case-progress-rail-connector" aria-hidden /> : null}
              <button
                type="button"
                className="case-progress-rail-btn"
                disabled={!clickable}
                onClick={() => tabTarget && onStepClick?.(tabTarget)}
                aria-current={step.state === 'current' ? 'step' : undefined}
                title={step.detail}
              >
                <span className="case-progress-rail-marker" aria-hidden>
                  <Icon size={14} strokeWidth={2.4} />
                </span>
                <span className="case-progress-rail-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
