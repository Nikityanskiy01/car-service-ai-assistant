import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, Copy, Phone } from 'lucide-react';
import { Badge } from '../console/ui/badge';
import { Button } from '../console/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../console/ui/table';
import type { RequestListParams } from '../../api/dashboard';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS, URGENCY_LABELS, urgencyHint } from '../../lib/labels';
import { formatRelativeTime, getRequestConfidence, getRequestUrgency } from '../../lib/managerRequestHelpers';
import { slaLabel } from '../../lib/requestSla';
import { QUEUE_STATUS_HINTS } from '../../lib/managerGuide';
import { HintLabel, HintTooltip } from './help/HintLabel';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

type SortKey = NonNullable<RequestListParams['sort']>;

type Props = {
  requests: ServiceRequest[];
  selectedIds: string[];
  sort: SortKey;
  dir: 'asc' | 'desc';
  refreshing?: boolean;
  requestBasePath: string;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleSort: (key: SortKey) => void;
  onCopyPhone: (phone: string) => void;
};

function statusVariant(status: ServiceRequestStatus): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'destructive';
  if (status === 'NEW') return 'warning';
  if (status === 'IN_PROGRESS') return 'default';
  return 'secondary';
}

function urgencyVariant(urgency: string | null): 'secondary' | 'warning' | 'destructive' {
  if (urgency === 'critical' || urgency === 'high') return 'destructive';
  if (urgency === 'medium') return 'warning';
  return 'secondary';
}

function rowTone(item: ServiceRequest, sla: string | null, urgency: string | null) {
  if (sla) return 'hot';
  if (urgency === 'critical' || urgency === 'high') return 'warn';
  if (item.status === 'NEW' && !item.assignedManager) return 'fresh';
  return undefined;
}

function isRowChrome(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('a, button, input, label, select'));
}

export function ManagerQueueTable({
  requests,
  selectedIds,
  sort,
  dir,
  refreshing,
  requestBasePath,
  onToggleSelected,
  onToggleSelectAll,
  onToggleSort,
  onCopyPhone,
}: Props) {
  const navigate = useNavigate();
  const allSelected = requests.length > 0 && selectedIds.length === requests.length;

  return (
    <>
      <div className={`queue-table${refreshing ? ' is-refreshing' : ''}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand-primary)]"
                    aria-label="Выбрать все заявки на странице"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                  />
              </TableHead>
              <TableHead>{sortableHeader(sort, dir, 'client', 'Клиент', onToggleSort)}</TableHead>
              <TableHead>{sortableHeader(sort, dir, 'car', 'Обращение', onToggleSort)}</TableHead>
              <TableHead>
                <HintLabel hint="Оценка ИИ по симптомам, не приоритет сервиса">Срочность</HintLabel>
              </TableHead>
              <TableHead>{sortableHeader(sort, dir, 'status', 'Статус', onToggleSort)}</TableHead>
              <TableHead>Менеджер</TableHead>
              <TableHead>{sortableHeader(sort, dir, 'createdAt', 'Когда', onToggleSort)}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((item) => {
              const urgency = getRequestUrgency(item.consultationSession);
              const confidence = getRequestConfidence(item.consultationSession);
              const phone = item.client?.phone || item.guestPhone;
              const detailPath = `${requestBasePath}/${item.id}`;
              const sla = slaLabel(item);
              const car = `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim();
              const clientName = item.client?.fullName || item.guestName || 'Гость';
              const tone = rowTone(item, sla, urgency);
                  const showAiGap =
                    !sla && !urgency && confidence == null && (item.status === 'NEW' || item.status === 'IN_PROGRESS');
                  return (
                    <TableRow
                      key={item.id}
                      className="queue-row"
                      data-tone={tone}
                      data-state={selectedIds.includes(item.id) ? 'selected' : undefined}
                      onClick={(event) => {
                        if (isRowChrome(event.target)) return;
                        navigate(detailPath);
                      }}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--brand-primary)]"
                          aria-label={`Выбрать заявку №${formatRequestNumber(item.id)}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => onToggleSelected(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="queue-client-cell">
                          <Link to={detailPath} className="queue-client-name">
                            {clientName}
                          </Link>
                          {phone ? (
                            <span className="queue-phone-row">
                              <a href={`tel:${phone}`} className="min-w-0 truncate tabular-nums">
                                {phone}
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0"
                                aria-label="Скопировать номер"
                                onClick={() => onCopyPhone(phone)}
                              >
                                <Copy />
                              </Button>
                            </span>
                          ) : null}
                          <span className="queue-request-id">№{formatRequestNumber(item.id)}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="queue-case-cell">
                          <span className="queue-car-line">{car || 'Авто не указано'}</span>
                          <span className="queue-problem-cell" title={item.snapshotSymptoms || undefined}>
                            {item.snapshotSymptoms?.slice(0, 90) || 'Без описания'}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="queue-signal-cell">
                          {sla ? <Badge variant="destructive">{sla}</Badge> : null}
                          {urgency && urgency !== 'low' ? (
                            <HintTooltip hint={urgencyHint(urgency)}>
                              <Badge variant={urgencyVariant(urgency)}>
                                {URGENCY_LABELS[urgency] || urgency}
                                {confidence != null ? ` ${confidence}%` : ''}
                              </Badge>
                            </HintTooltip>
                          ) : null}
                          {!sla && (!urgency || urgency === 'low') && confidence != null ? (
                            <span className="queue-ai-meta">ИИ {confidence}%</span>
                          ) : null}
                          {showAiGap ? <span className="queue-ai-meta">нет оценки</span> : null}
                        </span>
                      </TableCell>
                  <TableCell>
                    <HintTooltip hint={QUEUE_STATUS_HINTS[item.status]}>
                      <Badge variant={statusVariant(item.status)}>{SERVICE_REQUEST_STATUS_LABELS[item.status]}</Badge>
                    </HintTooltip>
                  </TableCell>
                  <TableCell>
                    {item.assignedManager?.fullName || <span className="text-muted-foreground">не назначен</span>}
                  </TableCell>
                  <TableCell>
                    <span className="queue-date-cell">
                      <span className="tabular-nums">{formatRelativeTime(item.createdAt)}</span>
                      <span className="block tabular-nums">{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="queue-actions-cell">
                      {phone ? (
                        <Button asChild variant="ghost" size="icon" className="size-8">
                          <a href={`tel:${phone}`} aria-label="Позвонить">
                            <Phone />
                          </a>
                        </Button>
                      ) : null}
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="queue-card-list">
        {requests.map((item) => {
          const phone = item.client?.phone || item.guestPhone;
          const sla = slaLabel(item);
          const urgency = getRequestUrgency(item.consultationSession);
          const car = `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim();
          return (
            <Link
              key={item.id}
              to={`${requestBasePath}/${item.id}`}
              className="queue-card"
              data-tone={rowTone(item, sla, urgency)}
            >
              <span className="queue-card-top">
                <strong>{item.client?.fullName || item.guestName || 'Гость'}</strong>
                <Badge variant={statusVariant(item.status)}>{SERVICE_REQUEST_STATUS_LABELS[item.status]}</Badge>
              </span>
              <span className="queue-card-meta">
                {car || 'Авто не указано'}
                <span className="tabular-nums">{formatRelativeTime(item.createdAt)}</span>
              </span>
              <span className="queue-card-problem">{item.snapshotSymptoms?.slice(0, 90) || 'Без описания'}</span>
              {phone ? <span className="queue-card-phone tabular-nums">{phone}</span> : null}
              {sla ? (
                <Badge variant="destructive" className="w-fit">
                  {sla}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}

function sortableHeader(
  sort: SortKey,
  dir: 'asc' | 'desc',
  key: SortKey,
  label: string,
  onToggle: (key: SortKey) => void,
) {
  const active = sort === key;
  return (
    <button
      type="button"
      className={`queue-sort-btn${active ? ' is-active' : ''}`}
      onClick={() => onToggle(key)}
      aria-label={`Сортировать по «${label}»`}
    >
      {label}
      {active ? dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : null}
    </button>
  );
}
