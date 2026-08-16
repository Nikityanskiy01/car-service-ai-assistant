import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Copy, Phone } from 'lucide-react';
import { toast } from 'sonner';
import {
  bulkAssignRequests,
  bulkExportRequestsToCrm,
  bulkPatchRequestStatuses,
  listServiceRequestBoard,
  listServiceRequests,
  patchServiceRequestStatus,
  type RequestBoardColumn,
  type RequestListParams,
} from '../../api/dashboard';
import { copyText } from '../../lib/clipboard';
import {
  loadSavedQueueFilters,
  removeQueueFilter,
  saveQueueFilter,
  type SavedQueueFilter,
} from '../../lib/savedQueueFilters';
import { BulkActionBar } from '../../components/manager/BulkActionBar';
import { ManagerQueueFilters, type QueueFilterState } from '../../components/manager/ManagerQueueFilters';
import { QUEUE_STATUSES } from '../../lib/queueStatuses';
import { ManagerKanban } from '../../components/requests/ManagerKanban';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Badge } from '../../components/console/ui/badge';
import { Button } from '../../components/console/ui/button';
import { Skeleton } from '../../components/console/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/console/ui/table';
import { managerZonePaths } from '../../config/managerPaths';
import {
  formatRelativeTime,
  getRequestConfidence,
  getRequestUrgency,
} from '../../lib/managerRequestHelpers';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { slaLabel } from '../../lib/requestSla';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

const PAGE_SIZE = 20;
const KANBAN_PAGE_SIZE = 20;

type SortKey = NonNullable<RequestListParams['sort']>;

type ManagerRequestsPageProps = {
  adminZone?: boolean;
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

function urgencyLabel(urgency: string) {
  if (urgency === 'critical') return 'Критическая';
  if (urgency === 'high') return 'Высокая';
  if (urgency === 'medium') return 'Средняя';
  return 'Низкая';
}

export function ManagerRequestsPage({ adminZone = false }: ManagerRequestsPageProps) {
  usePageMeta({
    title: adminZone ? 'Заявки — операции' : 'Очередь',
    description: 'Список и канбан заявок сервиса.',
  });

  const paths = managerZonePaths(adminZone);
  const [searchParams, setSearchParams] = useSearchParams();

  const scope = searchParams.get('scope') === 'mine' ? 'mine' : 'all';
  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'list';
  const q = searchParams.get('q') || '';
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const urgencyFilter = searchParams.get('urgency') || '';
  const feedbackFilter = searchParams.get('feedback') || '';
  const slaFilter = searchParams.get('sla') || '';
  const sourceFilter = searchParams.get('source') || '';
  const periodFilter = searchParams.get('period') || '';
  const hasDiagnosisFilter = searchParams.get('hasDiagnosis') || '';
  const sort = (searchParams.get('sort') as SortKey | null) || 'createdAt';
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const statuses = useMemo<ServiceRequestStatus[]>(() => {
    const single = searchParams.get('status');
    const many = searchParams.get('statuses');
    const raw = many ? many.split(',') : single ? [single] : [];
    return raw.filter((value): value is ServiceRequestStatus =>
      QUEUE_STATUSES.includes(value as ServiceRequestStatus),
    );
  }, [searchParams]);

  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [board, setBoard] = useState<Partial<Record<ServiceRequestStatus, RequestBoardColumn>>>({});
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState<Partial<Record<ServiceRequestStatus, boolean>>>({});
  const [savedFilters, setSavedFilters] = useState<SavedQueueFilter[]>(() => loadSavedQueueFilters());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const firstLoadRef = useRef(true);

  const queryKey = [
    q,
    page,
    view,
    scope,
    statuses.join(','),
    urgencyFilter,
    feedbackFilter,
    slaFilter,
    sourceFilter,
    periodFilter,
    hasDiagnosisFilter,
    sort,
    dir,
  ].join('|');
  const debouncedQueryKey = useDebouncedValue(queryKey, 120);

  const sharedParams = useMemo<Omit<RequestListParams, 'page' | 'pageSize'>>(
    () => ({
      status: statuses.length === 1 ? statuses[0] : undefined,
      statuses: statuses.length > 1 ? statuses.join(',') : undefined,
      q: q || undefined,
      sort,
      dir,
      mine: scope === 'mine',
      urgency: urgencyFilter ? (urgencyFilter as 'low' | 'medium' | 'high' | 'critical') : undefined,
      feedback: feedbackFilter
        ? (feedbackFilter as 'none' | 'CORRECT' | 'PARTIAL' | 'INCORRECT')
        : undefined,
      sla: slaFilter === 'breached' ? 'breached' : undefined,
      source: sourceFilter ? (sourceFilter as 'guest' | 'registered' | 'contact') : undefined,
      period: periodFilter ? (periodFilter as 'today' | '7d' | 'all') : undefined,
      hasDiagnosis: hasDiagnosisFilter || undefined,
    }),
    [
      statuses,
      q,
      sort,
      dir,
      scope,
      urgencyFilter,
      feedbackFilter,
      slaFilter,
      sourceFilter,
      periodFilter,
      hasDiagnosisFilter,
    ],
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (view === 'kanban') {
        const data = await listServiceRequestBoard({ ...sharedParams, pageSize: KANBAN_PAGE_SIZE });
        setBoard(data.columns);
        setRequests([]);
        setTotal(data.total);
        setSelectedIds([]);
      } else {
        const data = await listServiceRequests({ ...sharedParams, page, pageSize: PAGE_SIZE });
        setRequests(data.items);
        setBoard({});
        setTotal(data.total);
        const visible = new Set(data.items.map((item) => item.id));
        setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
      }
      setLastUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки');
    } finally {
      setRefreshing(false);
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setFirstLoad(false);
      }
    }
  }, [sharedParams, page, view]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQueryKey]);

  useDashboardPolling(() => void load(), 60_000);

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (!value) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setStatuses = useCallback(
    (next: ServiceRequestStatus[]) => {
      updateParams({
        status: next.length === 1 ? next[0] : undefined,
        statuses: next.length > 1 ? next.join(',') : undefined,
        page: '1',
      });
    },
    [updateParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams();
        const currentView = current.get('view');
        if (currentView) next.set('view', currentView);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sort === key) {
        updateParams({ dir: dir === 'asc' ? 'desc' : 'asc' });
        return;
      }
      updateParams({ sort: key, dir: key === 'createdAt' ? 'desc' : 'asc' });
    },
    [sort, dir, updateParams],
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === requests.length ? [] : requests.map((item) => item.id)));
  }

  async function runBulk(
    action: () => Promise<unknown>,
    successMessage: string,
    errorMessage: string,
  ) {
    if (!selectedIds.length) return;
    const count = selectedIds.length;
    setBulkBusy(true);
    try {
      await action();
      setSelectedIds([]);
      await load();
      toast.success(successMessage, { description: `Затронуто заявок: ${count}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : errorMessage);
    } finally {
      setBulkBusy(false);
    }
  }

  async function onStatusChange(item: ServiceRequest, status: ServiceRequestStatus) {
    const previousRequests = requests;
    const previousBoard = board;
    setRequests((prev) => prev.map((row) => (row.id === item.id ? { ...row, status } : row)));
    setBoard((prev) => moveBoardItem(prev, item, status));
    try {
      await patchServiceRequestStatus(item.id, status, item.version);
      await load();
      toast.success('Статус обновлён', { description: `№${formatRequestNumber(item.id)}` });
    } catch (e) {
      setRequests(previousRequests);
      setBoard(previousBoard);
      toast.error(e instanceof Error ? e.message : 'Не удалось изменить статус');
    }
  }

  async function onLoadMore(status: ServiceRequestStatus) {
    const column = board[status];
    if (!column || column.items.length >= column.total || loadingMore[status]) return;
    const nextPage = Math.floor(column.items.length / KANBAN_PAGE_SIZE) + 1;
    setLoadingMore((prev) => ({ ...prev, [status]: true }));
    try {
      const data = await listServiceRequests({
        ...sharedParams,
        status,
        statuses: undefined,
        page: nextPage,
        pageSize: KANBAN_PAGE_SIZE,
      });
      setBoard((prev) => {
        const current = prev[status];
        if (!current) return prev;
        const seen = new Set(current.items.map((item) => item.id));
        return {
          ...prev,
          [status]: {
            ...current,
            items: [...current.items, ...data.items.filter((item) => !seen.has(item.id))],
            total: data.total,
            page: nextPage,
          },
        };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось подгрузить колонку');
    } finally {
      setLoadingMore((prev) => ({ ...prev, [status]: false }));
    }
  }

  async function copyPhone(phone: string) {
    const ok = await copyText(phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  const filterState: QueueFilterState = {
    q,
    scope,
    view,
    statuses,
    urgency: urgencyFilter,
    feedback: feedbackFilter,
    sla: slaFilter,
    source: sourceFilter,
    period: periodFilter,
    hasDiagnosis: hasDiagnosisFilter,
  };

  const allSelected = requests.length > 0 && selectedIds.length === requests.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(statuses.length || q || scope === 'mine');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {adminZone
          ? 'Административный обзор заявок: поиск, фильтры и статусы.'
          : 'Поиск, фильтры и работа со статусами обращений.'}
      </p>

      <ManagerQueueFilters
        state={filterState}
        total={total}
        refreshing={refreshing}
        lastUpdatedAt={lastUpdatedAt}
        savedFilters={savedFilters}
        onPatch={updateParams}
        onStatusesChange={setStatuses}
        onReset={resetFilters}
        onRefresh={() => void load()}
        onApplyPreset={(preset) => {
          resetFilters();
          updateParams({ ...preset.params, page: '1' });
        }}
        onSavePreset={(label) => {
          const params: Record<string, string> = {};
          searchParams.forEach((value, key) => {
            if (key !== 'page' && key !== 'view') params[key] = value;
          });
          setSavedFilters(saveQueueFilter(label, params));
          toast.success('Пресет сохранён', { description: label });
        }}
        onRemovePreset={(id) => setSavedFilters(removeQueueFilter(id))}
      />

      <BulkActionBar
        selectedCount={selectedIds.length}
        busy={bulkBusy}
        onAssign={(managerId) =>
          void runBulk(
            () => bulkAssignRequests(selectedIds, managerId),
            managerId ? 'Заявки назначены менеджеру' : 'Заявки назначены на вас',
            'Не удалось назначить заявки',
          )
        }
        onStatusChange={(status) =>
          void runBulk(
            () => bulkPatchRequestStatuses(selectedIds, status),
            'Статус изменён',
            'Не удалось сменить статус',
          )
        }
        onExportCrm={() =>
          void runBulk(
            () => bulkExportRequestsToCrm(selectedIds),
            'Заявки отправлены в учётную систему',
            'Не удалось экспортировать в CRM',
          )
        }
        onClear={() => setSelectedIds([])}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить очередь</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Проверьте соединение и повторите попытку.</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {firstLoad ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {!firstLoad && !error && total === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-medium">Заявок не найдено</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtersActive
              ? 'Ни одна заявка не подходит под текущие фильтры.'
              : 'Новые обращения появятся после консультаций и заявок с сайта.'}
          </p>
          {filtersActive ? (
            <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          ) : null}
        </div>
      ) : null}

      {!firstLoad && !error && total > 0 && view === 'kanban' ? (
        <ManagerKanban
          columns={board}
          requestBasePath={paths.requests}
          loadingMore={loadingMore}
          onStatusChange={(item, status) => void onStatusChange(item, status)}
          onLoadMore={(status) => void onLoadMore(status)}
        />
      ) : null}

      {!firstLoad && !error && requests.length > 0 && view === 'list' ? (
        <>
          <div className={`hidden rounded-xl border border-border bg-card lg:block ${refreshing ? 'opacity-80' : ''}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--brand-primary)]"
                      aria-label="Выбрать все заявки на странице"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Номер</TableHead>
                  <TableHead>{sortableHeader(sort, dir, 'client', 'Клиент', toggleSort)}</TableHead>
                  <TableHead>{sortableHeader(sort, dir, 'car', 'Автомобиль', toggleSort)}</TableHead>
                  <TableHead>Проблема</TableHead>
                  <TableHead>ИИ</TableHead>
                  <TableHead>Ответ</TableHead>
                  <TableHead>{sortableHeader(sort, dir, 'status', 'Статус', toggleSort)}</TableHead>
                  <TableHead>Менеджер</TableHead>
                  <TableHead>{sortableHeader(sort, dir, 'createdAt', 'Дата', toggleSort)}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((item) => {
                  const urgency = getRequestUrgency(item.consultationSession);
                  const confidence = getRequestConfidence(item.consultationSession);
                  const phone = item.client?.phone || item.guestPhone;
                  const detailPath = `${paths.requests}/${item.id}`;
                  const sla = slaLabel(item);
                  const car = `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim();
                  return (
                    <TableRow key={item.id} data-state={selectedIds.includes(item.id) ? 'selected' : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--brand-primary)]"
                          aria-label={`Выбрать заявку №${formatRequestNumber(item.id)}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Link to={detailPath} className="font-medium tabular-nums text-foreground">
                            №{formatRequestNumber(item.id)}
                          </Link>
                          {item.status === 'NEW' ? <Badge variant="warning">Новая</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col gap-0.5">
                          <span>{item.client?.fullName || item.guestName || 'Гость'}</span>
                          {phone ? (
                            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                              <a href={`tel:${phone}`} className="min-w-0 truncate">
                                {phone}
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0"
                                aria-label="Скопировать номер"
                                onClick={() => void copyPhone(phone)}
                              >
                                <Copy />
                              </Button>
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{car || 'Не указан'}</TableCell>
                      <TableCell className="max-w-56">
                        <span className="line-clamp-2" title={item.snapshotSymptoms || undefined}>
                          {item.snapshotSymptoms?.slice(0, 70) || 'Без описания'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {urgency ? <Badge variant={urgencyVariant(urgency)}>{urgencyLabel(urgency)}</Badge> : (
                            <span className="text-muted-foreground">нет</span>
                          )}
                          {confidence != null ? (
                            <span className="text-xs text-muted-foreground tabular-nums">{confidence}%</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{sla ? <Badge variant="destructive">{sla}</Badge> : null}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>{SERVICE_REQUEST_STATUS_LABELS[item.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.assignedManager?.fullName || <span className="text-muted-foreground">не назначен</span>}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="tabular-nums">{formatRelativeTime(item.createdAt)}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(item.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center justify-end gap-1">
                          {phone ? (
                            <Button asChild variant="ghost" size="icon" className="size-8">
                              <a href={`tel:${phone}`} aria-label="Позвонить">
                                <Phone />
                              </a>
                            </Button>
                          ) : null}
                          <Button asChild variant="ghost" size="sm">
                            <Link to={detailPath}>Открыть</Link>
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 lg:hidden">
            {requests.map((item) => {
              const phone = item.client?.phone || item.guestPhone;
              const sla = slaLabel(item);
              return (
                <Link
                  key={item.id}
                  to={`${paths.requests}/${item.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-card px-3 py-3 text-inherit no-underline transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent/40 active:scale-[0.99]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="tabular-nums">№{formatRequestNumber(item.id)}</strong>
                    <Badge variant={statusVariant(item.status)}>{SERVICE_REQUEST_STATUS_LABELS[item.status]}</Badge>
                  </span>
                  <span>{item.client?.fullName || item.guestName || 'Гость'}</span>
                  <span className="text-sm text-muted-foreground">
                    {`${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || 'Авто не указано'}
                  </span>
                  {phone ? <span className="text-xs text-muted-foreground tabular-nums">{phone}</span> : null}
                  {sla ? <Badge variant="destructive" className="w-fit">{sla}</Badge> : null}
                  <span className="text-xs text-muted-foreground tabular-nums">{formatRelativeTime(item.createdAt)}</span>
                </Link>
              );
            })}
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Назад
              </Button>
              <span className="tabular-nums text-muted-foreground">
                {page} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Дальше
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
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
      className={`inline-flex appearance-none border-0 bg-transparent p-0 font-medium cursor-pointer items-center gap-1 transition-colors duration-150 hover:text-foreground ${active ? 'text-foreground' : 'text-muted-foreground'}`}
      onClick={() => onToggle(key)}
      aria-label={`Сортировать по «${label}»`}
    >
      {label}
      {active ? dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : null}
    </button>
  );
}

function moveBoardItem(
  board: Partial<Record<ServiceRequestStatus, RequestBoardColumn>>,
  item: ServiceRequest,
  nextStatus: ServiceRequestStatus,
) {
  const next = { ...board };
  const from = next[item.status];
  if (from) {
    next[item.status] = {
      ...from,
      items: from.items.filter((row) => row.id !== item.id),
      total: Math.max(0, from.total - 1),
    };
  }
  const to = next[nextStatus];
  const moved = { ...item, status: nextStatus };
  if (to) {
    next[nextStatus] = {
      ...to,
      items: [moved, ...to.items.filter((row) => row.id !== item.id)],
      total: to.total + (to.items.some((row) => row.id === item.id) ? 0 : 1),
    };
  }
  return next;
}
