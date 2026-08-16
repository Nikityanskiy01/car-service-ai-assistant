import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from '../../lib/toast';
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
import { ManagerQueueTable } from '../../components/manager/ManagerQueueTable';
import { QUEUE_STATUSES } from '../../lib/queueStatuses';
import { ManagerKanban } from '../../components/requests/ManagerKanban';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Button } from '../../components/console/ui/button';
import { Skeleton } from '../../components/console/ui/skeleton';
import { managerZonePaths } from '../../config/managerPaths';
import { formatRequestNumber } from '../../lib/labels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

const PAGE_SIZE = 20;
const KANBAN_PAGE_SIZE = 20;

type SortKey = NonNullable<RequestListParams['sort']>;

type ManagerRequestsPageProps = {
  adminZone?: boolean;
};

export function ManagerRequestsPage({ adminZone = false }: ManagerRequestsPageProps) {
  usePageMeta({
    title: adminZone ? 'Заявки — операции' : 'Очередь',
    description: 'Заявки клиентов: ответ, назначение, запись.',
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
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [board, setBoard] = useState<Partial<Record<ServiceRequestStatus, RequestBoardColumn>>>({});
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState<Partial<Record<ServiceRequestStatus, boolean>>>({});
  const [savedFilters, setSavedFilters] = useState<SavedQueueFilter[]>(() => loadSavedQueueFilters());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

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

  const queueQuery = useQuery({
    queryKey: ['manager-requests', debouncedQueryKey],
    queryFn: async () => {
      if (view === 'kanban') {
        const data = await listServiceRequestBoard({ ...sharedParams, pageSize: KANBAN_PAGE_SIZE });
        return { kind: 'kanban' as const, columns: data.columns, items: [] as ServiceRequest[], total: data.total };
      }
      const data = await listServiceRequests({ ...sharedParams, page, pageSize: PAGE_SIZE });
      return { kind: 'list' as const, columns: {} as Partial<Record<ServiceRequestStatus, RequestBoardColumn>>, items: data.items, total: data.total };
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const refreshing = queueQuery.isFetching && !queueQuery.isPending;
  const error = queueQuery.error instanceof Error ? queueQuery.error.message : null;

  useEffect(() => {
    const data = queueQuery.data;
    if (!data) return;
    if (data.kind === 'kanban') {
      setBoard(data.columns);
      setRequests([]);
      setTotal(data.total);
      setSelectedIds([]);
    } else {
      setRequests(data.items);
      setBoard({});
      setTotal(data.total);
      const visible = new Set(data.items.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
    }
    setLastUpdatedAt(new Date());
    setFirstLoad(false);
  }, [queueQuery.data]);

  const load = useCallback(async () => {
    await queueQuery.refetch();
  }, [queueQuery]);

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

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(
    statuses.length ||
      q ||
      scope === 'mine' ||
      urgencyFilter ||
      feedbackFilter ||
      slaFilter ||
      sourceFilter ||
      periodFilter ||
      hasDiagnosisFilter,
  );

  return (
    <div className="queue-page">
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
            'Не удалось отправить в учётную систему',
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
        <div className="queue-skeleton" aria-hidden>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {!firstLoad && !error && total === 0 ? (
        <div className="queue-empty">
          <p className="queue-empty-title">{filtersActive ? 'По фильтрам пусто' : 'Очередь пуста'}</p>
          <p className="queue-empty-text">
            {filtersActive
              ? 'Ни одна заявка не подходит. Сбросьте фильтры или смените срез.'
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
          <ManagerQueueTable
            requests={requests}
            selectedIds={selectedIds}
            sort={sort}
            dir={dir}
            refreshing={refreshing}
            requestBasePath={paths.requests}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSort={toggleSort}
            onCopyPhone={(phone) => void copyPhone(phone)}
          />

          {pageCount > 1 ? (
            <div className="queue-pager">
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
