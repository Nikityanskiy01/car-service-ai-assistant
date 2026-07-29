import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  bulkAssignRequests,
  bulkExportRequestsToCrm,
  bulkPatchRequestStatuses,
  listServiceRequests,
  patchServiceRequestStatus,
} from '../../api/dashboard';
import { CopyPhoneButton } from '../../components/ui/CopyPhoneButton';
import { loadSavedQueueFilters } from '../../lib/savedQueueFilters';
import { BulkActionBar } from '../../components/manager/BulkActionBar';
import { ManagerKanban } from '../../components/requests/ManagerKanban';
import { SlaBadge } from '../../components/requests/SlaBadge';
import { UrgencyBadge } from '../../components/consultation/UrgencyBadge';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { getRequestConfidence, getRequestUrgency } from '../../lib/managerRequestHelpers';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

const STATUSES: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

type ManagerRequestsPageProps = {
  adminZone?: boolean;
};

export function ManagerRequestsPage({ adminZone = false }: ManagerRequestsPageProps) {
  usePageMeta({
    title: adminZone ? 'Заявки — операции' : 'Очередь',
    description: 'Список и канбан заявок сервиса.',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = searchParams.get('scope') === 'mine' ? 'mine' : 'all';
  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'list';
  const statusFilter = (searchParams.get('status') as ServiceRequestStatus | null) || undefined;
  const q = searchParams.get('q') || '';
  const page = Number(searchParams.get('page') || '1');
  const urgencyFilter = searchParams.get('urgency') || '';
  const feedbackFilter = searchParams.get('feedback') || '';
  const slaFilter = searchParams.get('sla') || '';
  const sourceFilter = searchParams.get('source') || '';
  const periodFilter = searchParams.get('period') || '';
  const hasDiagnosisFilter = searchParams.get('hasDiagnosis') || '';
  const statusesFilter = searchParams.get('statuses') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(q);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listServiceRequests({
        status: statusFilter,
        q: q || undefined,
        page,
        pageSize: view === 'kanban' ? 100 : 20,
        sort: 'createdAt',
        dir: 'desc',
        mine: scope === 'mine',
        urgency: urgencyFilter ? (urgencyFilter as 'low' | 'medium' | 'high' | 'critical') : undefined,
        feedback: feedbackFilter
          ? (feedbackFilter as 'none' | 'CORRECT' | 'PARTIAL' | 'INCORRECT')
          : undefined,
        sla: slaFilter === 'breached' ? 'breached' : undefined,
        source: sourceFilter ? (sourceFilter as 'guest' | 'registered' | 'contact') : undefined,
        period: periodFilter ? (periodFilter as 'today' | '7d' | 'all') : undefined,
        hasDiagnosis: hasDiagnosisFilter || undefined,
        statuses: statusesFilter || undefined,
      });
      setRequests(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q, page, view, scope, urgencyFilter, feedbackFilter, slaFilter, sourceFilter, periodFilter, hasDiagnosisFilter, statusesFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, q, page, view, scope, urgencyFilter, feedbackFilter, slaFilter, sourceFilter, periodFilter, hasDiagnosisFilter, statusesFilter]);

  useDashboardPolling(() => void load(), 60_000);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map((r) => r.id));
    }
  }

  async function runBulkAssign(managerId?: string) {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    setError(null);
    try {
      await bulkAssignRequests(selectedIds, managerId);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось назначить заявки');
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkExportCrm() {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    setError(null);
    try {
      await bulkExportRequestsToCrm(selectedIds);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось экспортировать в CRM');
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkStatus(status: ServiceRequestStatus) {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    setError(null);
    try {
      await bulkPatchRequestStatuses(selectedIds, status);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить статус');
    } finally {
      setBulkBusy(false);
    }
  }

  const savedFilters = useMemo(() => loadSavedQueueFilters(), []);

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  async function onStatusChange(item: ServiceRequest, status: ServiceRequestStatus) {
    try {
      await patchServiceRequestStatus(item.id, status, item.version);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить статус');
    }
  }

  const tableRows = useMemo(
    () =>
      requests.map((item) => {
        const urgency = getRequestUrgency(item.consultationSession);
        const confidence = getRequestConfidence(item.consultationSession);
        const phone = item.client?.phone || item.guestPhone;
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
              <Link to={`/dashboard/manager/requests/${item.id}`}>№{formatRequestNumber(item.id)}</Link>
              {item.status === 'NEW' ? <StatusBadge status="NEW" /> : null}
            </span>
          ),
          client: (
            <span>
              {item.client?.fullName || item.guestName || 'Гость'}
              {phone ? (
                <small className="muted block">
                  {phone}
                  <CopyPhoneButton phone={phone} label="" />
                </small>
              ) : null}
            </span>
          ),
          car: `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || '—',
          problem: item.snapshotSymptoms?.slice(0, 60) || '—',
          ai: (
            <span className="queue-ai-cell">
              {urgency ? <UrgencyBadge urgency={urgency} /> : '—'}
              {confidence != null ? <small>{confidence}%</small> : null}
            </span>
          ),
          sla: <SlaBadge request={item} />,
          status: <StatusBadge status={item.status} />,
          manager: item.assignedManager?.fullName || '—',
          date: (
            <span>
              {formatRelativeTime(item.createdAt)}
              <small className="muted block">{new Date(item.createdAt).toLocaleDateString('ru-RU')}</small>
            </span>
          ),
          actions: (
            <Link to={`/dashboard/manager/requests/${item.id}`}>
              <Button variant="ghost">Открыть</Button>
            </Link>
          ),
        };
      }),
    [requests, selectedIds],
  );

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={adminZone ? 'Заявки' : 'Очередь'}
        description={
          adminZone
            ? 'Административный обзор заявок: поиск, фильтры и статусы.'
            : 'Поиск, фильтры и работа со статусами обращений.'
        }
        breadcrumbs={
          adminZone
            ? [
                { label: 'Пульт', to: '/dashboard/admin' },
                { label: 'Операции' },
                { label: 'Заявки' },
              ]
            : [
                { label: 'Рабочий стол', to: '/dashboard/manager' },
                { label: 'Очередь' },
              ]
        }
      />

      <Card className="filter-bar">
        <form
          className="filter-bar-row"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: searchInput || undefined, page: '1' });
          }}
        >
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по клиенту, телефону или автомобилю"
            aria-label="Поиск заявок"
          />
          <Select
            value={statusFilter || ''}
            onChange={(e) => updateParams({ status: e.target.value || undefined, page: '1' })}
            aria-label="Фильтр по статусу"
          >
            <option value="">Все статусы</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_REQUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            value={urgencyFilter}
            onChange={(e) => updateParams({ urgency: e.target.value || undefined, page: '1' })}
            aria-label="Срочность ИИ"
          >
            <option value="">Любая срочность</option>
            <option value="critical">Критическая</option>
            <option value="high">Высокая</option>
            <option value="medium">Средняя</option>
            <option value="low">Низкая</option>
          </Select>
          <Select
            value={feedbackFilter}
            onChange={(e) => updateParams({ feedback: e.target.value || undefined, page: '1' })}
            aria-label="Оценка ИИ"
          >
            <option value="">Любая оценка ИИ</option>
            <option value="none">Без оценки</option>
            <option value="CORRECT">Верный</option>
            <option value="PARTIAL">Частично</option>
            <option value="INCORRECT">Неверный</option>
          </Select>
          <Select
            value={slaFilter}
            onChange={(e) => updateParams({ sla: e.target.value || undefined, page: '1' })}
            aria-label="SLA"
          >
            <option value="">Все SLA</option>
            <option value="breached">Просрочено (&gt;4ч)</option>
          </Select>
          <Select
            value={sourceFilter}
            onChange={(e) => updateParams({ source: e.target.value || undefined, page: '1' })}
            aria-label="Источник"
          >
            <option value="">Любой источник</option>
            <option value="registered">Зарегистрирован</option>
            <option value="guest">Гость</option>
            <option value="contact">Форма сайта</option>
          </Select>
          <Select
            value={periodFilter}
            onChange={(e) => updateParams({ period: e.target.value || undefined, page: '1' })}
            aria-label="Период"
          >
            <option value="">Весь период</option>
            <option value="today">Сегодня</option>
            <option value="7d">7 дней</option>
          </Select>
          <Select
            value={hasDiagnosisFilter}
            onChange={(e) => updateParams({ hasDiagnosis: e.target.value || undefined, page: '1' })}
            aria-label="Диагноз ИИ"
          >
            <option value="">Диагноз: любой</option>
            <option value="true">Есть диагноз</option>
            <option value="false">Нет диагноза</option>
          </Select>
          <Select
            multiple
            value={statusesFilter ? statusesFilter.split(',') : []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((o) => o.value);
              updateParams({ statuses: values.length ? values.join(',') : undefined, status: undefined, page: '1' });
            }}
            aria-label="Статусы"
            className="filter-multiselect"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_REQUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button type="submit">Найти</Button>
        </form>
        <div className="saved-filters-row">
          {savedFilters.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="ghost"
              onClick={() => updateParams({ ...preset.params, page: '1' })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="filter-bar-tabs">
          <Tabs
            value={scope}
            onChange={(v) => updateParams({ scope: v === 'all' ? undefined : v, page: '1' })}
            items={[
              { id: 'all', label: 'Все' },
              { id: 'mine', label: 'Мои' },
            ]}
          />
          <Tabs
            value={view}
            onChange={(v) => updateParams({ view: v === 'list' ? undefined : v })}
            items={[
              { id: 'list', label: 'Список' },
              { id: 'kanban', label: 'Канбан' },
            ]}
          />
        </div>
      </Card>

      <BulkActionBar
        selectedCount={selectedIds.length}
        busy={bulkBusy}
        onAssign={(managerId) => void runBulkAssign(managerId)}
        onStatusChange={(status) => void runBulkStatus(status)}
        onExportCrm={() => void runBulkExportCrm()}
        onClear={() => setSelectedIds([])}
      />

      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && !requests.length ? (
        <EmptyState
          title="Заявок не найдено"
          description={statusFilter || scope === 'mine' ? 'Попробуйте сбросить фильтры.' : 'Новые обращения появятся после консультаций.'}
        />
      ) : null}

      {!loading && !error && requests.length && view === 'kanban' ? (
        <ManagerKanban requests={requests} onStatusChange={(item, s) => void onStatusChange(item, s)} />
      ) : null}

      {!loading && !error && requests.length && view === 'list' ? (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                {
                  key: 'select',
                  label: (
                    <input
                      type="checkbox"
                      aria-label="Выбрать все на странице"
                      checked={requests.length > 0 && selectedIds.length === requests.length}
                      onChange={toggleSelectAll}
                    />
                  ),
                },
                { key: 'number', label: 'Номер' },
                { key: 'client', label: 'Клиент' },
                { key: 'car', label: 'Автомобиль' },
                { key: 'problem', label: 'Проблема' },
                { key: 'ai', label: 'ИИ' },
                { key: 'sla', label: 'SLA' },
                { key: 'status', label: 'Статус' },
                { key: 'manager', label: 'Менеджер' },
                { key: 'date', label: 'Дата' },
                { key: 'actions', label: '' },
              ]}
              rows={tableRows}
            />
          </div>
          <div className="mobile-only responsive-card-list">
            {requests.map((item) => (
              <Link key={item.id} to={`/dashboard/manager/requests/${item.id}`} className="responsive-data-card">
                <header>
                  <strong>№{formatRequestNumber(item.id)}</strong>
                  <StatusBadge status={item.status} />
                </header>
                <p>{item.client?.fullName || item.guestName || 'Гость'}</p>
                <p className="muted">
                  {`${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || 'Авто не указано'}
                </p>
                <SlaBadge request={item} />
                <small>{formatRelativeTime(item.createdAt)}</small>
              </Link>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={20}
            total={total}
            onChange={(p) => updateParams({ page: String(p) })}
          />
        </>
      ) : null}
    </div>
  );
}
