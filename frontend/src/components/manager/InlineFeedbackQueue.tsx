import { Link } from 'react-router-dom';
import { QuickFeedbackButtons } from '../requests/QuickFeedbackButtons';
import { formatRequestNumber } from '../../lib/labels';
import type { ConsultationFeedback, ServiceRequest } from '../../types/serviceRequest';

type Props = {
  items: ServiceRequest[];
  onSaved?: () => void;
};

export function InlineFeedbackQueue({ items, onSaved }: Props) {
  if (!items.length) return null;

  return (
    <ul className="inline-feedback-queue">
      {items.map((item) => (
        <li key={item.id} className="inline-feedback-item">
          <div>
            <Link to={`/dashboard/manager/requests/${item.id}`}>
              №{formatRequestNumber(item.id)}
            </Link>
            <span className="muted">
              {' '}
              · {[item.snapshotMake, item.snapshotModel].filter(Boolean).join(' ') || 'Авто'}
            </span>
          </div>
          <QuickFeedbackButtons
            requestId={item.id}
            initial={(item.consultationSession?.feedback as ConsultationFeedback | undefined) ?? null}
            onSaved={() => onSaved?.()}
          />
        </li>
      ))}
    </ul>
  );
}
