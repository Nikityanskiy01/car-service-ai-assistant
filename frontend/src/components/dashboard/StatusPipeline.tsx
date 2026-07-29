import { SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import type { ServiceRequestStatus } from '../../types/serviceRequest';

const PIPELINE: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'];

export function StatusPipeline({ current }: { current: ServiceRequestStatus }) {
  if (current === 'CANCELLED') {
    return (
      <div className="status-pipeline is-cancelled" role="status">
        <span>Заявка отменена</span>
      </div>
    );
  }

  const currentIdx = PIPELINE.indexOf(current);

  return (
    <ol className="status-pipeline" aria-label="Этапы обработки заявки">
      {PIPELINE.map((step, idx) => {
        const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming';
        return (
          <li key={step} className={`status-pipeline-step is-${state}`}>
            <span className="status-pipeline-dot" aria-hidden />
            <span className="status-pipeline-label">{SERVICE_REQUEST_STATUS_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
