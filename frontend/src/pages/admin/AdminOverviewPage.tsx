import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAnalyticsKpi, listAdminUsers, listContacts, listServiceRequests } from '../../api/dashboard';
import { listIntegrations } from '../../api/integrations';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { useDashboardContext } from '../../components/layout/dashboard/useDashboardContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { adminQuickActions } from '../../config/dashboardNav';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AdminOverviewPage() {
  usePageMeta({ title: 'Рабочий стол администратора', description: 'Сводка системы и быстрые действия.' });
  const { setBadges } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<Awaited<ReturnType<typeof getAnalyticsKpi>> | null>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listAdminUsers>>>([]);
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof listIntegrations>>>([]);
  const [contacts, setContacts] = useState(0);
  const [newRequests, setNewRequests] = useState(0);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, usersData, integData, contactsData, requestsData] = await Promise.all([
        getAnalyticsKpi(),
        listAdminUsers(),
        listIntegrations(),
        listContacts(),
        listServiceRequests({ status: 'NEW', pageSize: 1 }),
      ]);
      setKpi(kpiData);
      setUsers(usersData);
      setIntegrations(integData);
      setContacts(contactsData.length);
      setNewRequests(requestsData.total);
      const failedIntegrations = integData.filter((x) => x.status === 'AUTH_ERROR' || x.status === 'UNAVAILABLE').length;
      setBadges({
        ...(failedIntegrations > 0 ? { integrationIssues: failedIntegrations } : {}),
        requests: requestsData.total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const warnings = useMemo(() => {
    const items: string[] = [];
    if (!users.some((u) => u.role === 'MANAGER' && !u.blocked)) items.push('Нет активных менеджеров');
    if (!integrations.some((x) => x.enabled)) items.push('Нет активных интеграций с CRM');
    if (integrations.some((x) => x.status === 'AUTH_ERROR')) items.push('Ошибка авторизации в учётной системе');
    return items;
  }, [users, integrations]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Рабочий стол"
        description="Обзор сервиса, пользователей и интеграций."
        actions={<Button variant="ghost" onClick={() => void load()}>Обновить</Button>}
      />

      <section className="quick-actions">
        {adminQuickActions.map((a) => (
          <Link key={a.to} to={a.to} className="quick-action-card">
            {a.label}
          </Link>
        ))}
      </section>

      {warnings.length ? (
        <Card className="system-warnings">
          <h2>Системные предупреждения</h2>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="metrics-grid">
        <AnalyticsMetricCard label="Пользователи" value={users.length} />
        <AnalyticsMetricCard label="Консультации" value={kpi?.consultations ?? kpi?.funnel.consultationsTotal ?? 0} />
        <AnalyticsMetricCard label="Заявки" value={kpi?.serviceRequests ?? kpi?.funnel.requestsTotal ?? 0} />
        <AnalyticsMetricCard label="Новые заявки" value={newRequests} />
        <AnalyticsMetricCard label="Записи" value={kpi?.bookings ?? kpi?.funnel.bookingsTotal ?? 0} />
        <AnalyticsMetricCard label="Обращения" value={contacts} />
        <AnalyticsMetricCard label="Подключения CRM" value={integrations.filter((x) => x.enabled).length} />
      </div>
    </div>
  );
}
