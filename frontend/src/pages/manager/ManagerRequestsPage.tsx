import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Phone } from 'lucide-react';
import {
  bulkAssignRequests,
  bulkExportRequestsToCrm,
  bulkPatchRequestStatuses,
  listServiceRequests,
  patchServiceRequestStatus,
  type RequestListParams,
} from '../../api/dashboard';
import { CopyPhoneButton } from '../../components/ui/CopyPhoneButton';
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
import { SlaBadge } from '../../components/requests/SlaBadge';
import { UrgencyBadge } from '../../components/consultation/UrgencyBadge';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/toastContext';
import { managerZonePaths } from '../../config/managerPaths';
import {
  formatRelativeTime,
  getRequestConfidence,
  getRequestUrgency,
} from '../../lib/managerRequestHelpers';
import { formatRequestNumber } from '../../lib/labels';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

const PAGE_SIZE = 20;

type SortKey = NonNullable<RequestListParams['sort']>;

type ManagerRequestsPageProps = {
  adminZone?: boolean;
};

export function ManagerRequestsPage({ adminZone = false }: ManagerRequestsPageProps) {
  usePageMeta({
    title: adminZone ? 'Заявки — операции' : 'Очередь',
    description: 'Список и канбан заявок сервиса.',
  });

  const paths = managerZonePaths(adminZone);
  const { success, error: toastError } = useToast();
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
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
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

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await listServiceRequests({
        status: statuses.length === 1 ? statuses[0] : undefined,
        statuses: statuses.length > 1 ? statuses.join(',') : undefined,
        q: q || undefined,
        page,
        pageSize: view === 'kanban' ? 100 : PAGE_SIZE,
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
      });
      setRequests(data.items);
      setTotal(data.total);
      setLastUpdatedAt(new Date());
      const visible = new Set(data.items.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить заявки');
    } finally {
      setRefreshing(false);
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setFirstLoad(false);
      }
    }
  }, [
    statuses,
    q,
    page,
    view,
    scope,
    urgencyFilter,
    feedbackFilter,
    slaFilter,
    sourceFilter,
    periodFilter,
    hasDiagnosisFilter,
    sort,
    dir,
  ]);

  useEffect(() => {
    void load();
    // Ключ запроса дебаунсится, чтобы быстрые клики по фильтрам не рождали гонку запросов.
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
        const view = current.get('view');
        if (view) next.set('view', view);
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
      success(successMessage, { description: `Затронуто заявок: ${count}` });
    } catch (e) {
      toastError(e instanceof Error ? e.message : errorMessage);
    } finally {
      setBulkBusy(false);
    }
  }

  async function onStatusChange(item: ServiceRequest, status: ServiceRequestStatus) {
    const previous = requests;
    setRequests((prev) => prev.map((row) => (row.id === item.id ? { ...row, status } : row)));
    try {
      await patchServiceRequestStatus(item.id, status, item.version);
      await load();
      success('Статус обновлён', { description: `№${formatRequestNumber(item.id)}` });
    } catch (e) {
      setRequests(previous);
      toastError(e instanceof Error ? e.message : 'Не удалось изменить статус');
    }
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

  const tableRows = useMemo(
    () =>
      requests.map((item) => {
        const urgency = getRequestUrgency(item.consultationSession);
        const confidence = getRequestConfidence(item.consultationSession);
        const phone = item.client?.phone || item.guestPhone;
        const detailPath = `${paths.requests}/${item.id}`;
        return {
          select: (
            <input
              type="checkbox"
              aria-label={`Выбрать заявку №${formatRequestNumber(item.id)}`}
              checked={selectedIds.includes(item.id)}
              onChange={() => toggleSelected(item.id)}
            />
          ),
          number: (
            <span className="queue-number-cell">
              <Link to={detailPath} className="tnum">
                №{formatRequestNumber(item.id)}
              </Link>
              {item.status === 'NEW' ? <StatusBadge status="NEW" /> : null}
            </span>
          ),
          client: (
            <span className="queue-client-cell">
              <span>{item.client?.fullName || item.guestName || 'Гость'}</span>
              {phone ? (
                <small className="muted queue-phone-row">
                  <a href={`tel:${phone}`} className="tnum">
                    {phone}
                  </a>
                  <CopyPhoneButton phone={phone} label="" />
                </small>
              ) : null}
            </span>
          ),
          car: `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || 'Не указан',
          problem: (
            <span className="queue-problem-cell" title={item.snapshotSymptoms || undefined}>
              {item.snapshotSymptoms?.slice(0, 70) || 'Без описания'}
            </span>
          ),
          ai: (
            <span className="queue-ai-cell">
              {urgency ? <UrgencyBadge urgency={urgency} /> : <span className="muted">нет</span>}
              {confidence != null ? <small className="tnum">{confidence}%</small> : null}
            </span>
          ),
          sla: <SlaBadge request={item} />,
          status: <StatusBadge status={item.status} />,
          manager: item.assignedManager?.fullName || <span className="muted">не назначен</span>,
          date: (
            <span className="queue-date-cell">
              <span className="tnum">{formatRelativeTime(item.createdAt)}</span>
              <small className="muted block tnum">
                {new Date(item.createdAt).toLocaleDateString('ru-RU')}
              </small>
            </span>
          ),
          actions: (
            <span className="queue-actions-cell">
              {phone ? (
                <a href={`tel:${phone}`} className="btn btn-ghost btn-icon" aria-label="Позвонить">
                  <Phone size={15} aria-hidden />
                </a>
              ) : null}
              <Link to={detailPath} className="btn btn-ghost">
                Открыть
              </Link>
            </span>
          ),
        };
      }),
    [requests, selectedIds, paths.requests],
  );

  function sortableHeader(key: SortKey, label: string) {
    const active = sort === key;
    return (
      <button
        type="button"
        className={`queue-sort-btn${active ? ' is-active' : ''}`}
        onClick={() => toggleSort(key)}
        aria-label={`Сортировать по «${label}»`}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp size={13} aria-hidden />
          ) : (
            <ArrowDown size={13} aria-hidden />
          )
        ) : null}
      </button>
    );
  }

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          aria-label="Выбрать все заявки на странице"
          checked={allSelected}
          onChange={toggleSelectAll}
        />
      ),
    },
    { key: 'number', label: 'Номер' },
    { key: 'client', label: sortableHeader('client', 'Клиент') },
    { key: 'car', label: sortableHeader('car', 'Автомобиль') },
    { key: 'problem', label: 'Проблема' },
    { key: 'ai', label: 'ИИ' },
    { key: 'sla', label: 'SLA' },
    { key: 'status', label: sortableHeader('status', 'Статус') },
    { key: 'manager', label: 'Менеджер' },
    { key: 'date', label: sortableHeader('createdAt', 'Дата') },
    { key: 'actions', label: '' },
  ];

  return (
    <div className="stack dashboard-page manager-queue-page">
      <PageHeader
        title={adminZone ? 'Заявки' : 'Очередь'}
        description={
          adminZone
            ? 'Административный обзор заявок: поиск, фильтры и статусы.'
            : 'Поиск, фильтры и работа со статусами обращений.'
        }
        breadcrumbs={adminZone ? undefined : [
                { label: 'Рабочий стол', to: paths.root },
                { label: 'Очередь' },
              ]
        }
      />

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
          success('Пресет сохранён', { description: label });
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

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {firstLoad ? (
        <div className="queue-skeleton" aria-hidden>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="skeleton-row" />
          ))}
        </div>
      ) : null}

      {!firstLoad && !error && !requests.length ? (
        <EmptyState
          title="Заявок не найдено"
          description={
            statuses.length || q || scope === 'mine'
              ? 'Ни одна заявка не подходит под текущие фильтры.'
              : 'Новые обращения появятся после консультаций и заявок с сайта.'
          }
          action={
            statuses.length || q || scope === 'mine' ? (
              <Button variant="secondary" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            ) : null
          }
        />
      ) : null}

      {!firstLoad && !error && requests.length > 0 ? (
        view === 'kanban' ? (
          <ManagerKanban
            requests={requests}
            requestBasePath={paths.requests}
            onStatusChange={(item, status) => void onStatusChange(item, status)}
          />
        ) : (
          <>
            <div className={`desktop-only queue-table${refreshing ? ' is-refreshing' : ''}`}>
              <DataTable columns={columns} rows={tableRows} />
            </div>
            <div className="mobile-only responsive-card-list">
              {requests.map((item) => (
                <Link
                  key={item.id}
                  to={`${paths.requests}/${item.id}`}
                  className="responsive-data-card"
                >
                  <header>
                    <strong className="tnum">№{formatRequestNumber(item.id)}</strong>
                    <StatusBadge status={item.status} />
                  </header>
                  <p>{item.client?.fullName || item.guestName || 'Гость'}</p>
                  <p className="muted">
                    {`${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || 'Авто не указано'}
                  </p>
                  <SlaBadge request={item} />
                  <small className="tnum">{formatRelativeTime(item.createdAt)}</small>
                </Link>
              ))}
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={(next) => updateParams({ page: String(next) })}
            />
          </>
        )
      ) : null}
    </div>
  );
}
