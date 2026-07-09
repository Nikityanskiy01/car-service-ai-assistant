import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listServiceRequests, patchServiceRequestStatus } from '../../api/dashboard';
import { ManagerKanban } from '../../components/requests/ManagerKanban';
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
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest, ServiceRequestStatus } from '../../types/serviceRequest';

const STATUSES: ServiceRequestStatus[] = ['NEW', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

export function ManagerRequestsPage() {
  usePageMeta({ title: 'Заявки', description: 'Список и канбан заявок сервиса.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'kanban' ? 'kanban' : 'list';
  const statusFilter = (searchParams.get('status') as ServiceRequestStatus | null) || undefined;
  const q = searchParams.get('q') || '';
  const page = Number(searchParams.get('page') || '1');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState(q);

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
      });
      setRequests(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки заявок');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q, page, view]);

  useEffect(() => {
    void load();
  }, [load]);

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
      requests.map((item) => ({
        number: (
          <Link to={`/dashboard/manager/requests/${item.id}`}>№{formatRequestNumber(item.id)}</Link>
        ),
        client: item.client?.fullName || item.guestName || 'Гость',
        car: `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || '—',
        problem: item.snapshotSymptoms?.slice(0, 60) || '—',
        status: <StatusBadge status={item.status} />,
        date: new Date(item.createdAt).toLocaleString('ru-RU'),
        actions: (
          <Link to={`/dashboard/manager/requests/${item.id}`}>
            <Button variant="ghost">Открыть</Button>
          </Link>
        ),
      })),
    [requests],
  );

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Заявки"
        description="Поиск, фильтры и работа со статусами обращений."
        breadcrumbs={[
          { label: 'Рабочий стол', to: '/dashboard/manager' },
          { label: 'Заявки' },
        ]}
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
            placeholder="Поиск по клиенту или автомобилю"
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
          <Button type="submit">Найти</Button>
        </form>
        <Tabs
          value={view}
          onChange={(v) => updateParams({ view: v === 'list' ? undefined : v })}
          items={[
            { id: 'list', label: 'Список' },
            { id: 'kanban', label: 'Канбан' },
          ]}
        />
      </Card>

      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error && !requests.length ? (
        <EmptyState
          title="Заявок не найдено"
          description={statusFilter ? 'Попробуйте сбросить фильтры.' : 'Новые обращения появятся после консультаций.'}
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
                { key: 'number', label: 'Номер' },
                { key: 'client', label: 'Клиент' },
                { key: 'car', label: 'Автомобиль' },
                { key: 'problem', label: 'Проблема' },
                { key: 'status', label: 'Статус' },
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
                <small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small>
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
