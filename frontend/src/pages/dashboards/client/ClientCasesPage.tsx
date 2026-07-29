import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { listBookings, listServiceRequests } from '../../../api/dashboard';
import { CaseCard } from '../../../components/client/CaseCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import {
  buildClientCases,
  filterCasesByQuery,
  filterCasesByTab,
  parseClientCaseTab,
} from '../../../features/client-cases/buildClientCases';
import type {
  BookingCaseInput,
  ClientCase,
  ClientCaseTab,
  ConsultationCaseInput,
  RequestCaseInput,
} from '../../../features/client-cases/types';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function ClientCasesPage() {
  usePageMeta({ title: 'Мои обращения', description: 'История диагностики, заявок и визитов.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseClientCaseTab(searchParams.get('tab'));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<ClientCase[]>([]);

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

  const filtered = useMemo(() => {
    const byTab = filterCasesByTab(cases, tab);
    return filterCasesByQuery(byTab, search);
  }, [cases, search, tab]);

  const counts = useMemo(
    () => ({
      active: filterCasesByTab(cases, 'active').length,
      archive: filterCasesByTab(cases, 'archive').length,
      drafts: filterCasesByTab(cases, 'drafts').length,
    }),
    [cases],
  );

  function setTab(next: ClientCaseTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  if (loading) return <Loader label="Загружаем обращения..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Мои обращения"
        description="Диагностика, заявки и визиты — в одной истории по каждому случаю."
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Обращения' },
        ]}
        actions={
          <Link className="btn btn-primary" to="/consult">
            Новая диагностика
          </Link>
        }
      />

      <Tabs
        value={tab}
        onChange={(id) => setTab(id as ClientCaseTab)}
        items={[
          { id: 'active', label: `Активные (${counts.active})` },
          { id: 'archive', label: `Архив (${counts.archive})` },
          { id: 'drafts', label: `Черновики (${counts.drafts})` },
        ]}
      />

      <div className="case-toolbar">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по авто или симптомам"
          aria-label="Поиск обращений"
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={
              tab === 'active'
                ? 'Нет активных обращений'
                : tab === 'drafts'
                  ? 'Незавершённых диалогов нет'
                  : 'Архив пуст'
            }
            description={
              tab === 'active'
                ? 'Опишите симптомы в ИИ-чате — обращение появится здесь.'
                : tab === 'drafts'
                  ? 'Начните новую диагностику, если нужна помощь с автомобилем.'
                  : 'Завершённые обращения появятся здесь автоматически.'
            }
            action={
              tab !== 'archive' ? (
                <Link className="btn btn-secondary btn-sm" to="/consult">
                  {tab === 'drafts' ? 'Начать диагностику' : 'Опишите симптомы в чате'}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="case-card-list">
            {filtered.map((item) => (
              <CaseCard key={item.id} clientCase={item} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
