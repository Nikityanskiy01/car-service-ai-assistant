import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquarePlus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { listBookings, listServiceRequests } from '../../../api/dashboard';
import { formatVehicleTitle, getVehicle, type ClientVehicle } from '../../../api/vehicles';
import { CaseCard } from '../../../components/client/CaseCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import {
  buildClientCases,
  filterCasesByQuery,
  filterCasesByTab,
  filterCasesByVehicle,
  parseClientCaseTab,
} from '../../../features/client-cases/buildClientCases';
import {
  groupClientCases,
  presentClientCase,
} from '../../../features/client-cases/presentClientCase';
import type {
  BookingCaseInput,
  ClientCase,
  ClientCaseTab,
  ConsultationCaseInput,
  RequestCaseInput,
} from '../../../features/client-cases/types';
import { usePageMeta } from '../../../hooks/usePageMeta';

const EMPTY_COPY: Record<ClientCaseTab, { title: string; description: string; action: string }> = {
  active: {
    title: 'Пока нет активных обращений',
    description: 'Опишите проблему в чате — здесь будет статус от заявки до записи.',
    action: 'Описать проблему',
  },
  archive: {
    title: 'В архиве пока пусто',
    description: 'Завершённые и отменённые обращения сохраняются здесь.',
    action: '',
  },
  drafts: {
    title: 'Черновиков нет',
    description: 'Если прервёте диагностику, незавершённый чат появится в этой вкладке.',
    action: 'Начать диагностику',
  },
};

export function ClientCasesPage() {
  usePageMeta({ title: 'Мои обращения', description: 'История диагностики, заявок и записей.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseClientCaseTab(searchParams.get('tab'));
  const vehicleId = searchParams.get('vehicleId');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<ClientVehicle | null>(null);

  useEffect(() => {
    if (!vehicleId) {
      setVehicleFilter(null);
      return;
    }
    void getVehicle(vehicleId)
      .then(setVehicleFilter)
      .catch(() => setVehicleFilter(null));
  }, [vehicleId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [consultations, requestsData, bookings] = await Promise.all([
          api<ConsultationCaseInput[]>('/consultations'),
          listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }),
          listBookings(),
        ]);
        setCases(
          buildClientCases(
            consultations,
            requestsData.items as RequestCaseInput[],
            bookings as BookingCaseInput[],
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки обращений');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabCounts = useMemo(
    () => ({
      active: filterCasesByTab(cases, 'active').length,
      archive: filterCasesByTab(cases, 'archive').length,
      drafts: filterCasesByTab(cases, 'drafts').length,
    }),
    [cases],
  );

  const shown = useMemo(() => {
    const byTab = filterCasesByTab(cases, tab);
    const byVehicle = filterCasesByVehicle(
      byTab,
      vehicleFilter
        ? {
            id: vehicleFilter.id,
            make: vehicleFilter.make,
            model: vehicleFilter.model,
            year: vehicleFilter.year,
          }
        : null,
    );
    return filterCasesByQuery(byVehicle, search);
  }, [cases, tab, vehicleFilter, search]);

  const groups = useMemo(() => groupClientCases(shown), [shown]);

  const attentionCase = useMemo(() => {
    if (tab !== 'active' || search.trim()) return null;
    return shown.find((item) => presentClientCase(item).attention) ?? null;
  }, [shown, tab, search]);

  function setTab(next: ClientCaseTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  function clearVehicleFilter() {
    const params = new URLSearchParams(searchParams);
    params.delete('vehicleId');
    setSearchParams(params, { replace: true });
  }

  if (loading) return <Loader label="Загружаем обращения..." />;
  if (error) return <ErrorState message={error} />;

  const vehicleTitle = vehicleFilter ? formatVehicleTitle(vehicleFilter) : null;
  const empty = EMPTY_COPY[tab];
  const useGroups = tab === 'active' && !search.trim() && groups.length > 1;

  return (
    <div className="stack dashboard-page client-cases-page">
      <PageHeader
        title="Мои обращения"
        description="Что сейчас с каждой заявкой — и куда нажать дальше."
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Обращения' },
        ]}
        actions={
          <Link className="btn btn-primary" to="/consult">
            <MessageSquarePlus size={18} aria-hidden />
            Новая диагностика
          </Link>
        }
      />

      <Tabs
        value={tab}
        onChange={(next) => setTab(next as ClientCaseTab)}
        items={[
          { id: 'active', label: `Активные (${tabCounts.active})` },
          { id: 'archive', label: `Архив (${tabCounts.archive})` },
          { id: 'drafts', label: `Черновики (${tabCounts.drafts})` },
        ]}
      />

      <div className="client-cases-toolbar">
        <label className="client-cases-search">
          <Search size={18} aria-hidden className="client-cases-search-icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти авто или симптомы"
            aria-label="Поиск обращений"
          />
          {search ? (
            <button
              type="button"
              className="client-cases-search-clear"
              onClick={() => setSearch('')}
              aria-label="Очистить поиск"
            >
              <X size={16} />
            </button>
          ) : null}
        </label>
      </div>

      {vehicleId && vehicleTitle ? (
        <div className="client-cases-filter-banner">
          <span>
            Показаны обращения по <strong>{vehicleTitle}</strong>
          </span>
          <Button type="button" variant="ghost" onClick={clearVehicleFilter}>
            Все авто
          </Button>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            title={search || vehicleTitle ? 'Ничего не найдено' : empty.title}
            description={
              search || vehicleTitle
                ? 'Измените запрос или сбросьте фильтр по автомобилю.'
                : empty.description
            }
            action={
              tab !== 'archive' && !search && !vehicleTitle ? (
                <Link className="btn btn-primary" to="/consult">
                  {empty.action}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : useGroups ? (
        <div className="client-cases-groups">
          {groups.map((group) => (
            <section key={group.group} className="client-cases-group" data-group={group.group}>
              <header className="client-cases-group-head">
                <h2>{group.label}</h2>
                <span>{group.items.length}</span>
              </header>
              <div className="client-cases-list">
                {group.items.map((item) => (
                  <CaseCard
                    key={item.id}
                    clientCase={item}
                    featured={attentionCase?.id === item.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="client-cases-list">
          {shown.map((item) => (
            <CaseCard
              key={item.id}
              clientCase={item}
              featured={attentionCase?.id === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
