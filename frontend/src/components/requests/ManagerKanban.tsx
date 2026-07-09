import { Link } from 'react-router-dom';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';
import { RequestStatusSelector } from './RequestStatusSelector';
import { ServiceRequestCard } from './ServiceRequestCard';

const columns: Array<{ status: ServiceRequestStatus; title: string }> = [
  { status: 'NEW', title: 'Новые' },
  { status: 'IN_PROGRESS', title: 'На рассмотрении' },
  { status: 'SCHEDULED', title: 'Запланировано' },
  { status: 'COMPLETED', title: 'Завершено' },
  { status: 'CANCELLED', title: 'Отменено' },
];

export function ManagerKanban({
  requests,
  onStatusChange,
}: {
  requests: ServiceRequest[];
  onStatusChange: (request: ServiceRequest, next: ServiceRequestStatus) => void;
}) {
  return (
    <section className="kanban-board" aria-label="Канбан заявок">
      {columns.map((column) => (
        <article key={column.status} className="kanban-column">
          <header>
            <h3>{column.title}</h3>
            <span>{requests.filter((item) => item.status === column.status).length}</span>
          </header>
          <div className="kanban-items">
            {requests
              .filter((item) => item.status === column.status)
              .map((item) => (
                <Link key={item.id} to={`/dashboard/manager/requests/${item.id}`} className="request-card-link">
                  <ServiceRequestCard
                    request={item}
                    extra={
                      <RequestStatusSelector
                        value={item.status}
                        onChange={(value) => onStatusChange(item, value)}
                      />
                    }
                  />
                </Link>
              ))}
          </div>
        </article>
      ))}
    </section>
  );
}
