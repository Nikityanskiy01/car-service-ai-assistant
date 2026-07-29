import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClientCase } from '../../features/client-cases/types';
import { StatusBadge } from '../ui/StatusBadge';
import { UrgencyBadge } from '../consultation/UrgencyBadge';

const STAGES = ['diagnosis', 'request', 'booking', 'done'] as const;

function stageIndex(stage: ClientCase['progressStage']) {
  return STAGES.indexOf(stage);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CaseCard({ clientCase }: { clientCase: ClientCase }) {
  const currentIdx = stageIndex(clientCase.progressStage);

  return (
    <Link to={`/dashboard/client/cases/${clientCase.id}`} className="case-card is-link">
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
          <StatusBadge status={clientCase.status} />
        </div>
      </div>

      <div className="case-mini-pipeline" aria-label="Прогресс обращения">
        {STAGES.map((stage, idx) => (
          <span
            key={stage}
            className={`case-mini-pipeline-dot ${
              idx < currentIdx ? 'is-done' : idx === currentIdx ? 'is-current' : 'is-upcoming'
            }`}
            title={stage}
          />
        ))}
        <span className="case-mini-pipeline-label">{clientCase.progressLabel}</span>
      </div>

      <div className="case-card-meta">
        <time>{formatDate(clientCase.lastActivityAt)}</time>
        {clientCase.kind === 'draft' ? <span>Черновик диагностики</span> : null}
      </div>
    </Link>
  );
}
