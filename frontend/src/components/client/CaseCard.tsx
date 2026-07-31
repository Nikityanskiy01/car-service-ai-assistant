import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClientCase, ClientCaseStage } from '../../features/client-cases/types';
import { clientProgressTone, ClientStatusBadge } from './ClientStatusBadge';
import { UrgencyBadge } from '../consultation/UrgencyBadge';
import { resolveClientStatusTone } from '../../lib/clientStatusLegend';

const CASE_STAGES: Array<{ id: ClientCaseStage; label: string }> = [
  { id: 'diagnosis', label: 'Диагностика' },
  { id: 'request', label: 'Заявка' },
  { id: 'booking', label: 'Запись' },
  { id: 'done', label: 'Готово' },
];

function stageIndex(stage: ClientCase['progressStage']) {
  return CASE_STAGES.findIndex((item) => item.id === stage);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CaseCard({
  clientCase,
  compact = false,
}: {
  clientCase: ClientCase;
  compact?: boolean;
}) {
  const currentIdx = Math.max(0, stageIndex(clientCase.progressStage));
  const stageTitle = CASE_STAGES[currentIdx]?.label ?? 'Обращение';
  const statusTone = resolveClientStatusTone(clientCase.status);
  const progressTone = clientProgressTone(clientCase.progressStage);

  return (
    <Link
      to={`/dashboard/client/cases/${clientCase.id}`}
      className={`case-card is-link${compact ? ' case-card-compact' : ''}`}
      data-status-tone={statusTone}
      data-progress-tone={progressTone}
    >
      <div className="case-card-head">
        <span className="case-card-icon" aria-hidden>
          <Car size={18} />
        </span>
        <div className="case-card-titles">
          <strong>{clientCase.title}</strong>
          <span className="case-card-symptoms">«{clientCase.symptoms}»</span>
        </div>
        <div className="case-card-badges">
          {clientCase.urgency ? <UrgencyBadge urgency={clientCase.urgency} /> : null}
          <ClientStatusBadge status={clientCase.status} />
        </div>
      </div>

      {compact ? (
        <div
          className="case-progress case-progress-compact"
          aria-label={`Этап ${currentIdx + 1} из ${CASE_STAGES.length}: ${stageTitle}. ${clientCase.progressLabel}`}
        >
          <div className="case-progress-compact-row">
            <span className="case-progress-stage-name">{stageTitle}</span>
            <span className="case-progress-label">{clientCase.progressLabel}</span>
          </div>
          <div
            className="case-progress-track"
            role="progressbar"
            aria-valuenow={clientCase.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={clientCase.progressLabel}
          >
            <span className="case-progress-fill" style={{ width: `${clientCase.progressPercent}%` }} />
          </div>
        </div>
      ) : (
        <div
          className="case-progress"
          aria-label={`Этап ${currentIdx + 1} из ${CASE_STAGES.length}: ${stageTitle}. ${clientCase.progressLabel}`}
        >
          <p className="case-progress-heading">
            <span className="case-progress-kicker">Текущий этап</span>
            <strong className="case-progress-stage-name">
              {stageTitle}
              <span className="case-progress-stage-num">
                {' '}
                ({currentIdx + 1} из {CASE_STAGES.length})
              </span>
            </strong>
          </p>
          <ol className="case-progress-steps" aria-label="Этапы обращения">
            {CASE_STAGES.map((stage, idx) => (
              <li
                key={stage.id}
                className={
                  idx < currentIdx ? 'is-done' : idx === currentIdx ? 'is-current' : 'is-upcoming'
                }
              >
                {stage.label}
              </li>
            ))}
          </ol>
          <div
            className="case-progress-track"
            role="progressbar"
            aria-valuenow={clientCase.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={clientCase.progressLabel}
          >
            <span className="case-progress-fill" style={{ width: `${clientCase.progressPercent}%` }} />
          </div>
          <p className="case-progress-label">{clientCase.progressLabel}</p>
        </div>
      )}

      <div className="case-card-meta">
        <time>{formatDate(clientCase.lastActivityAt)}</time>
        {clientCase.kind === 'draft' ? <span>Черновик диагностики</span> : null}
      </div>
    </Link>
  );
}
