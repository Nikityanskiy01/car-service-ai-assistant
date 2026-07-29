import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';
import { formatRelativeTime, getRequestUrgency } from '../../lib/managerRequestHelpers';
import { RequestStatusSelector } from './RequestStatusSelector';
import { ServiceRequestCard } from './ServiceRequestCard';
import { SlaBadge } from './SlaBadge';
import { UrgencyBadge } from '../consultation/UrgencyBadge';

const WIP_LIMIT_NEW = 10;

const columns: Array<{ status: ServiceRequestStatus; title: string; collapsible?: boolean }> = [
  { status: 'NEW', title: 'Новые' },
  { status: 'IN_PROGRESS', title: 'На рассмотрении' },
  { status: 'SCHEDULED', title: 'Запланировано' },
  { status: 'COMPLETED', title: 'Завершено' },
  { status: 'CANCELLED', title: 'Отменено', collapsible: true },
];

export function ManagerKanban({
  requests,
  onStatusChange,
}: {
  requests: ServiceRequest[];
  onStatusChange: (request: ServiceRequest, next: ServiceRequestStatus) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ServiceRequestStatus | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ CANCELLED: true });

  const newCount = useMemo(() => requests.filter((r) => r.status === 'NEW').length, [requests]);

  function handleDrop(columnStatus: ServiceRequestStatus) {
    const item = requests.find((r) => r.id === draggingId);
    setDraggingId(null);
    setDropTarget(null);
    if (item && item.status !== columnStatus) {
      onStatusChange(item, columnStatus);
    }
  }

  return (
    <section className="kanban-board" aria-label="Канбан заявок">
      {columns.map((column) => {
        const columnItems = requests.filter((item) => item.status === column.status);
        const isCollapsed = column.collapsible && collapsed[column.status];
        const overWip = column.status === 'NEW' && newCount > WIP_LIMIT_NEW;

        return (
          <article
            key={column.status}
            className={`kanban-column${dropTarget === column.status ? ' is-drop-target' : ''}${overWip ? ' is-wip-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(column.status);
            }}
            onDragLeave={() => setDropTarget((prev) => (prev === column.status ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(column.status);
            }}
          >
            <header>
              <h3>{column.title}</h3>
              <span>
                {columnItems.length}
                {column.status === 'NEW' ? ` / ${WIP_LIMIT_NEW}` : ''}
              </span>
              {column.collapsible ? (
                <button
                  type="button"
                  className="kanban-collapse-btn"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [column.status]: !prev[column.status] }))}
                >
                  {isCollapsed ? 'Показать' : 'Скрыть'}
                </button>
              ) : null}
            </header>
            {!isCollapsed ? (
              <div className="kanban-items">
                {columnItems.map((item) => {
                  const urgency = getRequestUrgency(item.consultationSession);
                  return (
                    <div
                      key={item.id}
                      className={`kanban-card-wrap${draggingId === item.id ? ' is-dragging' : ''}`}
                      draggable
                      onDragStart={() => setDraggingId(item.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                    >
                      <Link to={`/dashboard/manager/requests/${item.id}`} className="request-card-link">
                        <ServiceRequestCard
                          request={item}
                          extra={
                            <div className="kanban-card-meta">
                              {urgency ? <UrgencyBadge urgency={urgency} /> : null}
                              <SlaBadge request={item} />
                              <small className="muted">{formatRelativeTime(item.createdAt)}</small>
                              {item.assignedManager?.fullName ? (
                                <small className="muted">{item.assignedManager.fullName}</small>
                              ) : null}
                              <RequestStatusSelector
                                value={item.status}
                                onChange={(value) => onStatusChange(item, value)}
                              />
                            </div>
                          }
                        />
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
