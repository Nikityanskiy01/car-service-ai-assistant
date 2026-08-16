import { Link } from 'react-router-dom';
import { QuickFeedbackButtons } from '../requests/QuickFeedbackButtons';
import { formatRequestNumber } from '../../lib/labels';
import type { ConsultationFeedback, ServiceRequest } from '../../types/serviceRequest';

type Props = {
  items: ServiceRequest[];
  onSaved?: () => void;
  requestBasePath?: string;
};

function diagnosisPreview(item: ServiceRequest) {
  const diagnosis = item.consultationSession?.diagnosis || item.consultationSession?.flowState?.diagnosis;
  const causes = (diagnosis?.probable_causes || []).map((cause) => String(cause).trim()).filter(Boolean);
  const summary = String(diagnosis?.summary || '').trim();
  const symptoms = String(item.snapshotSymptoms || '').trim();
  return {
    symptoms,
    causes: causes.slice(0, 3),
    summary,
    vehicle: [item.snapshotMake, item.snapshotModel].filter(Boolean).join(' ') || 'Авто',
  };
}

export function InlineFeedbackQueue({
  items,
  onSaved,
  requestBasePath = '/dashboard/manager/requests',
}: Props) {
  if (!items.length) return null;

  return (
    <ul className="ai-quality-queue">
      {items.map((item) => {
        const preview = diagnosisPreview(item);
        return (
          <li key={item.id} className="ai-quality-review">
            <div className="ai-quality-review-copy">
              <div className="ai-quality-review-head">
                <strong className="ai-quality-review-car">{preview.vehicle}</strong>
                <Link to={`${requestBasePath}/${item.id}`} className="ai-quality-review-num">
                  №{formatRequestNumber(item.id)}
                </Link>
              </div>
              {preview.symptoms ? <p className="ai-quality-review-symptoms">{preview.symptoms}</p> : null}
              {preview.causes.length ? (
                <ol className="ai-quality-review-causes">
                  {preview.causes.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ol>
              ) : preview.summary ? (
                <p className="ai-quality-review-symptoms">{preview.summary}</p>
              ) : (
                <p className="ai-quality-review-symptoms is-muted">Диагноз в карточке заявки пока не сохранён.</p>
              )}
            </div>
            <QuickFeedbackButtons
              compact
              requestId={item.id}
              initial={(item.consultationSession?.feedback as ConsultationFeedback | undefined) ?? null}
              onSaved={() => onSaved?.()}
            />
          </li>
        );
      })}
    </ul>
  );
}
