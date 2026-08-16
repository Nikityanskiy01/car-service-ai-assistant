import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RequestBoardColumn } from '../../api/dashboard';
import { Badge } from '../console/ui/badge';
import { Button } from '../console/ui/button';
import { ScrollArea } from '../console/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../console/ui/select';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { formatRelativeTime, getRequestUrgency } from '../../lib/managerRequestHelpers';
import { QUEUE_STATUSES } from '../../lib/queueStatuses';
import { slaLabel } from '../../lib/requestSla';
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

function urgencyLabel(urgency: string) {
  if (urgency === 'critical') return 'Критическая';
  if (urgency === 'high') return 'Высокая';
  if (urgency === 'medium') return 'Средняя';
  return 'Низкая';
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
    <section className="flex gap-3 overflow-x-auto pb-2" aria-label="Канбан заявок">
      {visible.map((status) => {
        const column = columns[status]!;
        const isCollapsed = status === 'CANCELLED' && Boolean(collapsed.CANCELLED);
        const overWip = status === 'NEW' && newTotal > WIP_LIMIT_NEW;
        const remaining = Math.max(0, column.total - column.items.length);

        return (
          <article
            key={status}
            className={`flex w-[17.5rem] shrink-0 flex-col rounded-xl border bg-card ${
              dropTarget === status ? 'border-primary ring-2 ring-primary/30' : 'border-border'
            } ${overWip ? 'border-destructive/50' : ''}`}
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
            <header className="flex items-center gap-2 px-3 py-2.5">
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{COLUMN_TITLES[status]}</h3>
              <Badge variant={overWip ? 'destructive' : 'secondary'} className="tabular-nums">
                {status === 'NEW' ? `${column.total} / ${WIP_LIMIT_NEW}` : column.total}
              </Badge>
              {status === 'CANCELLED' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setCollapsed((prev) => ({ ...prev, CANCELLED: !prev.CANCELLED }))}
                >
                  {isCollapsed ? 'Показать' : 'Скрыть'}
                </Button>
              ) : null}
            </header>
            {!isCollapsed ? (
              <ScrollArea className="h-[min(36rem,62vh)]">
                <div className="flex flex-col gap-2 px-2 pb-3">
                  {column.items.map((item) => {
                    const urgency = getRequestUrgency(item.consultationSession);
                    const sla = slaLabel(item);
                    const car = `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim();
                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border border-border bg-background ${draggingId === item.id ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={() => setDraggingId(item.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }}
                      >
                        <Link
                          to={`${requestBasePath}/${item.id}`}
                          className="flex flex-col gap-1.5 px-3 py-2.5 text-inherit no-underline transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent/60 active:scale-[0.99]"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <strong className="text-sm tabular-nums">№{formatRequestNumber(item.id)}</strong>
                            {sla ? (
                              <Badge variant="destructive">{sla}</Badge>
                            ) : null}
                          </span>
                          <span className="truncate text-sm">{item.client?.fullName || item.guestName || 'Гость'}</span>
                          <span className="truncate text-xs text-muted-foreground">{car || 'Авто не указано'}</span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {item.snapshotSymptoms?.slice(0, 90) || 'Без описания'}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {urgency ? (
                              <Badge variant={urgencyVariant(urgency)}>{urgencyLabel(urgency)}</Badge>
                            ) : null}
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </span>
                          {item.assignedManager?.fullName ? (
                            <span className="truncate text-xs text-muted-foreground">{item.assignedManager.fullName}</span>
                          ) : null}
                        </Link>
                        <div
                          className="border-t border-border px-2 py-1.5"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <Select
                            value={item.status}
                            onValueChange={(value) => onStatusChange(item, value as ServiceRequestStatus)}
                          >
                            <SelectTrigger
                              className="h-8 text-xs"
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
                  {!column.items.length ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Пусто</p>
                  ) : null}
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
              </ScrollArea>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
