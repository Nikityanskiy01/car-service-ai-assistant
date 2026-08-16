import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { RequestBoardColumn } from '../../api/dashboard';
import { Badge } from '../console/ui/badge';
import { Button } from '../console/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../console/ui/select';
import { formatRequestNumber, formatUrgencyLabel, SERVICE_REQUEST_STATUS_LABELS, urgencyHint } from '../../lib/labels';
import { formatRelativeTime, getRequestUrgency } from '../../lib/managerRequestHelpers';
import { QUEUE_STATUSES } from '../../lib/queueStatuses';
import { slaLabel } from '../../lib/requestSla';
import { QUEUE_STATUS_HINTS } from '../../lib/managerGuide';
import { HintTooltip } from '../manager/help/HintLabel';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

const WIP_LIMIT_NEW = 10;

const COLUMN_TITLES: Record<ServiceRequestStatus, string> = {
  NEW: 'Новые',
  IN_PROGRESS: 'В работе',
  SCHEDULED: 'Запланировано',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

function urgencyVariant(urgency: string | null): 'secondary' | 'warning' | 'destructive' {
  if (urgency === 'critical' || urgency === 'high') return 'destructive';
  if (urgency === 'medium') return 'warning';
  return 'secondary';
}

export function ManagerKanban({
  columns,
  onStatusChange,
  onLoadMore,
  loadingMore,
  requestBasePath = '/dashboard/manager/requests',
}: {
  columns: Partial<Record<ServiceRequestStatus, RequestBoardColumn>>;
  onStatusChange: (request: ServiceRequest, next: ServiceRequestStatus) => void;
  onLoadMore: (status: ServiceRequestStatus) => void;
  loadingMore?: Partial<Record<ServiceRequestStatus, boolean>>;
  requestBasePath?: string;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ServiceRequestStatus | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ CANCELLED: true });

  const visible = QUEUE_STATUSES.filter((status) => columns[status]);
  const newTotal = columns.NEW?.total ?? 0;

  function handleDrop(columnStatus: ServiceRequestStatus) {
    const item = visible
      .flatMap((status) => columns[status]?.items ?? [])
      .find((request) => request.id === draggingId);
    setDraggingId(null);
    setDropTarget(null);
    if (item && item.status !== columnStatus) {
      onStatusChange(item, columnStatus);
    }
  }

  return (
    <section
      className="kanban-board"
      aria-label="Доска заявок по статусам"
      style={{ '--kanban-cols': String(visible.length) } as CSSProperties}
    >
      {visible.map((status) => {
        const column = columns[status]!;
        const isCollapsed = status === 'CANCELLED' && Boolean(collapsed.CANCELLED);
        const overWip = status === 'NEW' && newTotal > WIP_LIMIT_NEW;
        const remaining = Math.max(0, column.total - column.items.length);

        return (
          <article
            key={status}
            className={[
              'kanban-column',
              dropTarget === status ? 'is-drop-target' : '',
              overWip ? 'is-wip-limit' : '',
              isCollapsed ? 'is-collapsed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(status);
            }}
            onDragLeave={() => setDropTarget((prev) => (prev === status ? null : prev))}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(status);
            }}
          >
            <header>
              <HintTooltip hint={QUEUE_STATUS_HINTS[status]}>
                <h3>{COLUMN_TITLES[status]}</h3>
              </HintTooltip>
              <HintTooltip
                hint={
                  status === 'NEW'
                    ? overWip
                      ? `Больше ${WIP_LIMIT_NEW} новых: разберите, чтобы не копить без ответа`
                      : `Перетащите карточку в другую колонку. Лимит внимания в «Новых»: ${WIP_LIMIT_NEW}`
                    : QUEUE_STATUS_HINTS[status]
                }
              >
                <Badge variant={overWip ? 'destructive' : 'secondary'} className="tabular-nums">
                  {status === 'NEW' ? `${column.total} / ${WIP_LIMIT_NEW}` : column.total}
                </Badge>
              </HintTooltip>
              {status === 'CANCELLED' ? (
                <button
                  type="button"
                  className="kanban-collapse-btn"
                  onClick={() => setCollapsed((prev) => ({ ...prev, CANCELLED: !prev.CANCELLED }))}
                >
                  {isCollapsed ? 'Показать' : 'Скрыть'}
                </button>
              ) : null}
            </header>
            <div className="kanban-items">
              {column.items.map((item) => {
                const urgency = getRequestUrgency(item.consultationSession);
                const sla = slaLabel(item);
                const car = `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim();
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
                    <Link
                      to={`${requestBasePath}/${item.id}`}
                      className="kanban-card-link"
                    >
                      <span className="kanban-card-top">
                        <strong>№{formatRequestNumber(item.id)}</strong>
                        {sla ? <Badge variant="destructive">{sla}</Badge> : null}
                      </span>
                      <span className="kanban-card-name">
                        {item.client?.fullName || item.guestName || 'Гость'}
                      </span>
                      <span className="kanban-card-car">{car || 'Авто не указано'}</span>
                      <span className="kanban-card-problem">
                        {item.snapshotSymptoms?.slice(0, 90) || 'Без описания'}
                      </span>
                      <span className="kanban-card-meta">
                        {urgency ? (
                          <HintTooltip hint={urgencyHint(urgency)}>
                            <Badge variant={urgencyVariant(urgency)}>{formatUrgencyLabel(urgency)}</Badge>
                          </HintTooltip>
                        ) : null}
                        <span className="kanban-card-time">{formatRelativeTime(item.createdAt)}</span>
                      </span>
                      {item.assignedManager?.fullName ? (
                        <span className="kanban-card-assignee">{item.assignedManager.fullName}</span>
                      ) : null}
                    </Link>
                    <div
                      className="kanban-card-status"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Select
                        value={item.status}
                        onValueChange={(value) => onStatusChange(item, value as ServiceRequestStatus)}
                      >
                        <SelectTrigger
                          className="kanban-status-trigger"
                          aria-label="Изменить статус заявки"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUEUE_STATUSES.map((nextStatus) => (
                            <SelectItem key={nextStatus} value={nextStatus}>
                              {SERVICE_REQUEST_STATUS_LABELS[nextStatus]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
              {!column.items.length ? <p className="kanban-column-empty">Пусто</p> : null}
              {remaining > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore?.[status]}
                  onClick={() => onLoadMore(status)}
                >
                  Ещё {remaining}
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
