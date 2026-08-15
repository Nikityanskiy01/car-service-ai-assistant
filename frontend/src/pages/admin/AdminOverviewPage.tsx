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
import {
  getAnalyticsKpi,
  getLlmStatus,
  listAdminUsers,
  listAuditEvents,
  listContacts,
  listServiceRequests,
} from '../../api/dashboard';
import { listIntegrations } from '../../api/integrations';
import { ActionInbox, type ActionInboxItem } from '../../components/admin/ActionInbox';
import { useDashboardContext } from '../../components/layout/dashboard/useDashboardContext';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { adminQuickActions } from '../../config/dashboardNav';
import { auditActionLabel } from '../../lib/auditLabels';
import { useAdminSystemStatus } from '../../hooks/useAdminSystemStatus';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AdminOverviewPage() {
  usePageMeta({ title: 'Пульт администратора', description: 'Операционный центр управления сервисом.' });
  const { setBadges } = useDashboardContext();
  const systemStatus = useAdminSystemStatus(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<Awaited<ReturnType<typeof getAnalyticsKpi>> | null>(null);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listAdminUsers>>>([]);
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof listIntegrations>>>([]);
  const [newContacts, setNewContacts] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [recentAudit, setRecentAudit] = useState<Awaited<ReturnType<typeof listAuditEvents>>>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, usersData, integData, contactsData, requestsData, llmData, auditData] = await Promise.all([
        getAnalyticsKpi(30),
        listAdminUsers(),
        listIntegrations(),
        listContacts('NEW'),
        listServiceRequests({ status: 'NEW', pageSize: 1 }),
        getLlmStatus(false),
        listAuditEvents({ limit: 6 }).catch(() => []),
      ]);
      setKpi(kpiData);
      setUsers(usersData);
      setIntegrations(integData);
      setNewContacts(contactsData.length);
      setNewRequests(requestsData.total);
      setLlmStatus(llmData);
      setRecentAudit(auditData);
      const failedIntegrations = integData.filter((x) => x.status === 'AUTH_ERROR' || x.status === 'UNAVAILABLE').length;
      setBadges({
        ...(failedIntegrations > 0 ? { integrationIssues: failedIntegrations } : {}),
        'ops-requests': requestsData.total,
        'ops-contacts': contactsData.length,
        'integration-conflicts': 0,
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
    if (systemStatus.failedJobs > 10) {
      items.push({
        id: 'failed-jobs',
        priority: 'P1',
        text: `Очередь синхронизации: ${systemStatus.failedJobs} ошибок`,
        to: '/dashboard/admin/integrations/jobs',
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
    if (newContacts > 0) {
      items.push({
        id: 'new-contacts',
        priority: 'P2',
        text: `${newContacts} новых обращений с сайта`,
        to: '/dashboard/admin/operations/contacts',
      });
    }
    return items;
  }, [users, integrations, llmStatus, newRequests, newContacts, systemStatus.failedJobs]);

  if (loading && !kpi) return <Loader label="Загружаем пульт..." />;
  if (error && !kpi) return <ErrorState message={error} onRetry={() => void load()} />;

  const managers = users.filter((u) => u.role === 'MANAGER' && !u.blocked).length;
  const blockedUsers = users.filter((u) => u.blocked).length;
  const enabledIntegrations = integrations.filter((x) => x.enabled).length;
  const brokenIntegrations = integrations.filter((x) => x.status === 'AUTH_ERROR' || x.status === 'UNAVAILABLE').length;
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
        description="Состояние сервиса за 30 дней. Сначала разберите критичное, затем очередь."
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
            <strong className="admin-bento-value tnum">{newRequests}</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/operations/contacts" className="admin-bento-card">
          <Activity size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Новые обращения</span>
            <strong className="admin-bento-value tnum">{newContacts}</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/analytics" className="admin-bento-card">
          <BarChart3 size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Конверсия в заявку</span>
            <strong className="admin-bento-value tnum">{conversion}%</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/operations/bookings" className="admin-bento-card">
          <CalendarDays size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Записи за период</span>
            <strong className="admin-bento-value tnum">{kpi?.bookings ?? kpi?.funnel.bookingsTotal ?? 0}</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/team/users" className="admin-bento-card">
          <Users size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">Менеджеры</span>
            <strong className="admin-bento-value tnum">{managers}</strong>
          </div>
        </Link>
        <Link to="/dashboard/admin/integrations" className="admin-bento-card">
          <Plug size={20} aria-hidden />
          <div>
            <span className="admin-bento-label">CRM подключено</span>
            <strong className="admin-bento-value tnum">{enabledIntegrations}</strong>
          </div>
        </Link>
      </div>

      {inboxItems.length ? (
        <ActionInbox items={inboxItems} />
      ) : (
        <Card className="admin-all-clear">
          <strong>Критичных предупреждений нет</strong>
          <p className="muted-text">ИИ, CRM и очередь в рабочем состоянии.</p>
        </Card>
      )}

      <section className="admin-quick-row" aria-label="Быстрые действия">
        {adminQuickActions.map((action) => (
          <Link key={action.to} to={action.to} className="admin-quick-chip">
            {action.label}
          </Link>
        ))}
        <Link to="/dashboard/admin/ai/status" className="admin-quick-chip">
          Проверить ИИ
        </Link>
        <Link to="/dashboard/admin/security/sessions" className="admin-quick-chip">
          Сессии
        </Link>
      </section>

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
                      <dd className="tnum">
                        {llmStatus.metrics.successRatePercent}% ({llmStatus.metrics.successes}/
                        {llmStatus.metrics.totalCalls})
                      </dd>
                    </div>
                    <div>
                      <dt>Latency p95</dt>
                      <dd className="tnum">
                        {llmStatus.metrics.latencyMs.p95 != null
                          ? `${llmStatus.metrics.latencyMs.p95} мс`
                          : '—'}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <Link to="/dashboard/admin/ai/status" className="btn btn-ghost">
                Открыть ИИ-студию
              </Link>
            </div>
          ) : (
            <p className="muted-text">Статус не загружен</p>
          )}
        </Card>

        <Card>
          <div className="card-section-header">
            <h2>Операции и команда</h2>
            <Link to="/dashboard/admin/analytics" className="btn btn-ghost">
              Аналитика
            </Link>
          </div>
          <dl className="detail-dl desk-profile-dl">
            <div>
              <dt>Консультации</dt>
              <dd className="tnum">{kpi?.consultations ?? kpi?.funnel.consultationsTotal ?? 0}</dd>
            </div>
            <div>
              <dt>Заявки всего</dt>
              <dd className="tnum">{kpi?.serviceRequests ?? kpi?.funnel.requestsTotal ?? 0}</dd>
            </div>
            <div>
              <dt>Конверсия заявка → запись</dt>
              <dd className="tnum">{kpi?.funnel.conversionRequestToBooking ?? 0}%</dd>
            </div>
            <div>
              <dt>Завершённые заявки</dt>
              <dd className="tnum">{kpi?.funnel.conversionCompleted ?? 0}%</dd>
            </div>
            <div>
              <dt>Пользователи / блок</dt>
              <dd className="tnum">
                {users.length} / {blockedUsers}
              </dd>
            </div>
            <div>
              <dt>Интеграции с ошибками</dt>
              <dd className="tnum">{brokenIntegrations}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <div className="card-section-header">
          <h2>Последние действия</h2>
          <Link to="/dashboard/admin/team/activity" className="btn btn-ghost">
            Вся лента
          </Link>
        </div>
        {recentAudit.length ? (
          <ul className="activity-feed activity-feed-rich">
            {recentAudit.map((event) => (
              <li key={event.id} className="is-audit">
                <time>{event.createdAt ? new Date(event.createdAt).toLocaleString('ru-RU') : '—'}</time>
                <strong>{auditActionLabel(event.action)}</strong>
                <span className="muted">{event.actor?.fullName || event.actor?.email || 'Система'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">Пока нет записей в журнале.</p>
        )}
      </Card>
    </div>
  );
}
