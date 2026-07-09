import type { ServiceRequestStatus } from '../../types/serviceRequest';

const sequence: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'];

export function ServiceRequestTimeline({ status }: { status: ServiceRequestStatus }) {
  const activeIndex = sequence.indexOf(status);
  const isCancelled = status === 'CANCELLED';
  return (
    <section className="request-timeline" aria-label="Этапы обработки заявки">
      <h4>Ход обработки</h4>
      <ol>
        {sequence.map((step, index) => {
          const state = isCancelled ? (index === 0 ? 'done' : 'cancelled') : index <= activeIndex ? 'done' : 'todo';
          return (
            <li key={step} className={`timeline-${state}`}>
              <span>{step}</span>
            </li>
          );
        })}
        {isCancelled ? <li className="timeline-cancelled"><span>CANCELLED</span></li> : null}
      </ol>
    </section>
  );
}
