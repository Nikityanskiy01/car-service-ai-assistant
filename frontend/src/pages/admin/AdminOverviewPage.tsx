import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  Plug,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { LlmStatus } from '../../api/dashboard';
import { getAnalyticsKpi, getLlmStatus, listAdminUsers, listContacts, listServiceRequests } from '../../api/dashboard';
import { listIntegrations } from '../../api/integrations';
import { ActionInbox, type ActionInboxItem } from '../../components/admin/ActionInbox';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { useDashboardContext } from '../../components/layout/dashboard/useDashboardContext';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { adminQuickActions } from '../../config/dashboardNav';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AdminOverviewPage() {
  usePageMeta({ title: 'Пульт администратора', description: 'Операционный центр управления сервисом.' });
  const { setBadges } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<Awaited<ReturnType<typeof getAnalyticsKpi>> | null>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listAdminUsers>>>([]);
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof listIntegrations>>>([]);
  const [contacts, setContacts] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, usersData, integData, contactsData, requestsData, llmData] = await Promise.all([
        getAnalyticsKpi(),
        listAdminUsers(),
        listIntegrations(),
        listContacts(),
        listServiceRequests({ status: 'NEW', pageSize: 1 }),
        getLlmStatus(false),
      ]);
      setKpi(kpiData);
      setUsers(usersData);
      setIntegrations(integData);
      setContacts(contactsData.length);
      setNewRequests(requestsData.total);
      setLlmStatus(llmData);
      const failedIntegrations = integData.filter((x) => x.status === 'AUTH_ERROR' || x.status === 'UNAVAILABLE').length;
      setBadges({
        ...(failedIntegrations > 0 ? { integrationIssues: failedIntegrations } : {}),
        'ops-requests': requestsData.total,
        'ops-contacts': contactsData.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const inboxItems = useMemo(() => {
    const items: ActionInboxItem[] = [];
    if (llmStatus && (llmStatus.state === 'unavailable' || llmStatus.state === 'disabled')) {
      items.push({
        id: 'llm-down',
        priority: 'P0',
        text: 'Интеллектуальный модуль недоступен или отключён',
        to: '/dashboard/admin/ai/status',
      });
    }
    if (integrations.some((x) => x.status === 'AUTH_ERROR')) {
      items.push({
        id: 'crm-auth',
        priority: 'P0',
        text: 'Ошибка авторизации в учётной системе',
        to: '/dashboard/admin/integrations',
      });
    }
    if (!users.some((u) => u.role === 'MANAGER' && !u.blocked)) {
      items.push({
        id: 'no-managers',
        priority: 'P1',
        text: 'Нет активных менеджеров',
        to: '/dashboard/admin/team/users',
      });
    }
    if (!integrations.some((x) => x.enabled)) {
      items.push({
        id: 'no-crm',
        priority: 'P2',
        text: 'Нет активных интеграций с CRM',
        to: '/dashboard/admin/integrations',
      });
    }
    if (newRequests > 0) {
      items.push({
        id: 'new-requests',
        priority: 'P2',
        text: `${newRequests} новых заявок ожидают обработки`,
        to: '/dashboard/admin/operations/requests?status=NEW',
      });
    }
    return items;
  }, [users, integrations, llmStatus, newRequests]);

  if (loading) return <Loader label="Загружаем пульт..." />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const managers = users.filter((u) => u.role === 'MANAGER' && !u.blocked).length;
  const enabledIntegrations = integrations.filter((x) => x.enabled).length;
  const llmStateLabel =
    llmStatus?.state === 'ok'
      ? 'Работает'
      : llmStatus?.state === 'degraded'
        ? 'Резервный режим'
        : llmStatus?.state === 'disabled'
          ? 'Отключён'
          : 'Недоступен';
  const conversion = kpi?.funnel.conversionConsultationToRequest ?? 0;

  return (
    <div className="stack dashboard-page admin-command-center">
      <PageHeader
        title="Пульт"
        description="Состояние сервиса, ИИ и операций — всё на одном экране."
        actions={
          <Button variant="ghost" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden /> Обновить
          </Button>
        }
      />

      <div className="admin-bento-grid">
        <Link to="/dashboard/admin/operations/requests?status=NEW" className="admin-bento-card accent">
          <ClipboardList size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Новые заявки</span>
            <strong className="admin-bento-value">{newRequests}</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/analytics" className="admin-bento-card">
          <BarChart3 size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Конверсия в заявку</span>
            <strong className="admin-bento-value">{conversion}%</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/operations/bookings" className="admin-bento-card">
          <CalendarDays size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Записи</span>
            <strong className="admin-bento-value">{kpi?.bookings ?? kpi?.funnel.bookingsTotal ?? 0}</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/team/users" className="admin-bento-card">
          <Users size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Менеджеры</span>
            <strong className="admin-bento-value">{managers}</strong>
          </div>
        </Link>
      </div>

      {inboxItems.length ? (
        <ActionInbox items={inboxItems} />
      ) : (
        <EmptyState title="Критичных предупреждений нет" description="Система в рабочем состоянии." />
      )}

      <section className="desk-action-grid" aria-label="Быстрые действия">
        {adminQuickActions.map((action) => (
          <Link key={action.to} to={action.to} className="desk-action-card">
            <Activity size={20} aria-hidden />
            <div>
              <strong>{action.label}</strong>
              <span>Перейти в раздел</span>
            </div>
          </Link>
        ))}
      </section>

      <div className="metrics-grid metrics-grid-4">
        <Link to="/dashboard/admin/team/users">
          <AnalyticsMetricCard label="Пользователи" value={users.length} icon={Users} />
        </Link>
        <Link to="/dashboard/admin/operations/requests">
          <AnalyticsMetricCard label="Заявки всего" value={kpi?.serviceRequests ?? kpi?.funnel.requestsTotal ?? 0} icon={ClipboardList} />
        </Link>
        <Link to="/dashboard/admin/operations/contacts">
          <AnalyticsMetricCard label="Обращения" value={contacts} icon={Activity} tone="accent" />
        </Link>
        <Link to="/dashboard/admin/integrations">
          <AnalyticsMetricCard label="CRM подключено" value={enabledIntegrations} icon={Plug} />
        </Link>
      </div>

      <div className="grid two admin-command-panels">
        <Card className="llm-status-card">
          <div className="card-section-header">
            <h2>
              <BrainCircuit size={18} aria-hidden /> Интеллектуальный модуль
            </h2>
            <span className={`llm-status-pill is-${llmStatus?.state || 'unavailable'}`}>{llmStateLabel}</span>
          </div>
          {llmStatus ? (
            <div className="stack compact">
              <p>{llmStatus.message || 'Статус конфигурации LLM'}</p>
              <p className="muted-text">
                Провайдер: {llmStatus.provider}
                {llmStatus.fallbackEnabled ? ' · fallback включён' : ''}
              </p>
              <dl className="detail-dl desk-profile-dl">
                <div>
                  <dt>Извлечение</dt>
                  <dd>{llmStatus.models.extraction}</dd>
                </div>
                <div>
                  <dt>Диагноз</dt>
                  <dd>{llmStatus.models.diagnosis}</dd>
                </div>
                {llmStatus.metrics ? (
                  <>
                    <div>
                      <dt>Успешных вызовов</dt>
                      <dd>
                        {llmStatus.metrics.successRatePercent}% ({llmStatus.metrics.successes}/
                        {llmStatus.metrics.totalCalls})
                      </dd>
                    </div>
                    <div>
                      <dt>Latency p95</dt>
                      <dd>
                        {llmStatus.metrics.latencyMs.p95 != null
                          ? `${llmStatus.metrics.latencyMs.p95} мс`
                          : '—'}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <Link to="/dashboard/admin/ai/status" className="btn btn-ghost">
                Подробнее в ИИ-студии
              </Link>
            </div>
          ) : (
            <p className="muted-text">Статус не загружен</p>
          )}
        </Card>

        <Card>
          <h2>Операционная сводка</h2>
          <dl className="detail-dl desk-profile-dl">
            <div>
              <dt>Консультации</dt>
              <dd>{kpi?.consultations ?? kpi?.funnel.consultationsTotal ?? 0}</dd>
            </div>
            <div>
              <dt>Конверсия заявка → запись</dt>
              <dd>{kpi?.funnel.conversionRequestToBooking ?? 0}%</dd>
            </div>
            <div>
              <dt>Завершённые заявки</dt>
              <dd>{kpi?.funnel.conversionCompleted ?? 0}%</dd>
            </div>
            <div>
              <dt>Интеграции с ошибками</dt>
              <dd>
                {integrations.filter((x) => x.status === 'AUTH_ERROR' || x.status === 'UNAVAILABLE').length}
              </dd>
            </div>
          </dl>
          <Link to="/dashboard/admin/analytics" className="btn btn-ghost">
            Открыть аналитику
          </Link>
        </Card>
      </div>
    </div>
  );
}
