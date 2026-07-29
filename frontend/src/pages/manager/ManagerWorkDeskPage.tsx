import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, CalendarClock, ClipboardList, MessageSquare, Users } from 'lucide-react';
import {
  getManagerKpi,
  getProfile,
  listBookings,
  listContacts,
  listRequestActivity,
  listServiceRequests,
  type ActivityItem,
  type ManagerKpi,
} from '../../api/dashboard';
import { AnalyticsBulletChart } from '../../components/analytics/AnalyticsBulletChart';
import { DashboardRecordCard } from '../../components/dashboard/DashboardRecordCard';
import { DashboardWelcomeHero } from '../../components/dashboard/DashboardWelcomeHero';
import { ActivityFeed } from '../../components/manager/ActivityFeed';
import { ManagerKpiFunnel } from '../../components/manager/ManagerKpiFunnel';
import { BookingDrawer } from '../../components/requests/BookingDrawer';
import { useDashboardContext } from '../../components/layout/dashboard/useDashboardContext';
import { PriorityQueueList } from '../../components/requests/PriorityQueueList';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { managerQuickActions } from '../../config/dashboardNav';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import {
  buildAttentionItems,
  requestNeedsFeedback,
} from '../../lib/managerRequestHelpers';
import { formatMinutesUntil } from '../../lib/timeFormat';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest } from '../../types/serviceRequest';
import type { ServiceBooking } from '../../types/dashboard';

function isToday(dateIso: string) {
  const d = new Date(dateIso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ManagerWorkDeskPage() {
  usePageMeta({ title: 'Рабочий стол менеджера', description: 'Сводка дня и приоритетные обращения.' });
  const { setBadges } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof listBookings>>>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof listContacts>>>([]);
  const [managerName, setManagerName] = useState('');
  const [managerKpi, setManagerKpi] = useState<ManagerKpi | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [reqData, bookingsData, contactsData, profile, kpiData, activityData] = await Promise.all([
        listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }),
        listBookings(),
        listContacts('NEW'),
        getProfile().catch(() => null),
        getManagerKpi(7).catch(() => null),
        listRequestActivity(10).catch(() => ({ items: [] })),
      ]);
      setRequests(reqData.items);
      setBookings(bookingsData);
      setContacts(contactsData);
      setManagerName(profile?.fullName?.split(' ')[0] || '');
      setManagerKpi(kpiData);
      setActivity(activityData.items);
      setLastRefresh(new Date());
      const pendingFeedback = reqData.items.filter((item) => requestNeedsFeedback(item)).length;
      const slaBreached = reqData.items.filter((r) => r.slaBreached).length;
      setBadges({
        requests: reqData.items.filter((r) => r.status === 'NEW').length + slaBreached,
        contacts: contactsData.length,
        'ai-quality': pendingFeedback,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setBadges]);

  useEffect(() => {
    void load();
  }, [load]);

  useDashboardPolling(() => void load(true), 60_000);

  const metrics = useMemo(() => {
    const newCount = requests.filter((r) => r.status === 'NEW').length;
    const staleCount = requests.filter((r) => r.slaBreached).length;
    const todayBookings = bookings.filter((b) => isToday(b.preferredAt));
    const pendingFeedback = requests.filter((item) => requestNeedsFeedback(item)).length;
    return { newCount, staleCount, todayBookings: todayBookings.length, pendingFeedback, contacts: contacts.length };
  }, [requests, bookings, contacts]);

  const attentionItems = useMemo(
    () => buildAttentionItems(requests, bookings, contacts),
    [requests, bookings, contacts],
  );

  const upcomingBookings = useMemo(
    () =>
      [...bookings]
        .filter((b) => new Date(b.preferredAt).getTime() >= Date.now() - 3600000)
        .sort((a, b) => new Date(a.preferredAt).getTime() - new Date(b.preferredAt).getTime())
        .slice(0, 6),
    [bookings],
  );

  const greeting = useMemo(() => {
    const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return date.charAt(0).toUpperCase() + date.slice(1);
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <DashboardWelcomeHero
        icon={ClipboardList}
        greeting="Рабочий стол"
        title={managerName ? `Добро пожаловать, ${managerName}` : 'Сводка дня'}
        description={`${greeting}. ${attentionItems.length ? `${attentionItems.length} задач требуют внимания.` : 'Срочных действий сейчас нет.'}`}
        actions={
          <div className="desk-hero-actions">
            {lastRefresh ? (
              <span className="muted desk-refresh-hint">
                Обновлено {lastRefresh.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <Button variant="ghost" onClick={() => void load()}>
              Обновить
            </Button>
          </div>
        }
      />

      <div className="metrics-grid metrics-grid-4">
        <Link to="/dashboard/manager/requests?status=NEW" className="kpi-bullet-link">
          <AnalyticsBulletChart label="Новые" value={metrics.newCount} max={10} hint="Цель ≤ 10" />
        </Link>
        <Link to="/dashboard/manager/requests?sla=breached" className="kpi-bullet-link">
          <AnalyticsBulletChart label="Просрочка SLA" value={metrics.staleCount} max={5} hint="Цель 0" />
        </Link>
        <Link to="/dashboard/manager/calendar" className="kpi-bullet-link">
          <AnalyticsBulletChart
            label="Сегодня в календаре"
            value={metrics.todayBookings}
            max={12}
            hint="Вместимость дня"
          />
        </Link>
        <Link to="/dashboard/manager/ai-quality" className="kpi-bullet-link">
          <AnalyticsBulletChart label="Ждут оценки ИИ" value={metrics.pendingFeedback} max={10} hint="Цель 0" />
        </Link>
      </div>

      {managerKpi ? (
        <Card>
          <ManagerKpiFunnel kpi={managerKpi} />
          <div className="manager-personal-kpi muted">
            <span>Мои активные: {managerKpi.personal.activeRequests}</span>
            <span>Сообщений за период: {managerKpi.personal.messagesSent}</span>
            <span>Конверсий входящих: {managerKpi.personal.contactsConverted}</span>
          </div>
        </Card>
      ) : null}

      <section className="desk-action-grid" aria-label="Быстрые действия">
        {managerQuickActions.map((action) => (
          <Link key={action.to} to={action.to} className="desk-action-card">
            {action.to.includes('requests') ? (
              <ClipboardList size={20} aria-hidden />
            ) : action.to.includes('calendar') ? (
              <CalendarClock size={20} aria-hidden />
            ) : action.to.includes('ai-quality') ? (
              <BrainCircuit size={20} aria-hidden />
            ) : (
              <MessageSquare size={20} aria-hidden />
            )}
            <div>
              <strong>{action.label}</strong>
              <span>Открыть раздел</span>
            </div>
          </Link>
        ))}
      </section>

      <Card>
        <header className="card-section-header">
          <h2>Сделать сейчас</h2>
          <Link to="/dashboard/manager/requests">Очередь</Link>
        </header>
        <PriorityQueueList
          items={attentionItems}
          onOpenBooking={(bookingId) => {
            const b = bookings.find((x) => x.id === bookingId) || null;
            setSelectedBooking(b);
          }}
          onStatusChanged={() => void load(true)}
        />
      </Card>

      <div className="grid two">
        <Card id="activity-feed">
          <header className="card-section-header">
            <h2>Лента активности</h2>
            <Link to="/dashboard/manager/requests">Вся история</Link>
          </header>
          <ActivityFeed items={activity} />
        </Card>

        <Card>
          <header className="card-section-header">
            <h2>Ближайшие записи</h2>
            <Link to="/dashboard/manager/calendar">Календарь</Link>
          </header>
          {upcomingBookings.length ? (
            <div className="desk-record-list">
              {upcomingBookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="desk-booking-btn"
                  onClick={() => setSelectedBooking(b)}
                >
                  <DashboardRecordCard
                    title={formatTime(b.preferredAt)}
                    subtitle={`${b.client?.fullName || b.guestName || 'Клиент'} · ${formatMinutesUntil(b.preferredAt)}`}
                    status={b.status}
                    icon={CalendarClock}
                  />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Нет записей" description="Запланированные визиты появятся здесь." />
          )}
        </Card>
      </div>

      {metrics.contacts > 0 ? (
        <Card className="hint-card">
          <Users size={18} />
          <div>
            <strong>Входящие с сайта: {metrics.contacts}</strong>
            <p>
              <Link to="/dashboard/manager/contacts">Открыть входящие</Link>
            </p>
          </div>
        </Card>
      ) : null}

      {activity.some((a) => a.type === 'CRM_FAILED') ? (
        <Card className="hint-card hint-card-danger">
          <MessageSquare size={18} />
          <div>
            <strong>Ошибки передачи в CRM</strong>
            <p>
              Проверьте заявки с failed jobs во вкладке «История и CRM» или{' '}
              <Link to="/dashboard/manager/requests">откройте очередь</Link>.
            </p>
          </div>
        </Card>
      ) : null}

      <BookingDrawer
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onUpdated={(b) => {
          setBookings((prev) => prev.map((x) => (x.id === b.id ? b : x)));
          setSelectedBooking(b);
        }}
      />
    </div>
  );
}
