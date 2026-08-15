import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardList, Inbox, RefreshCw } from 'lucide-react';
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
import { Skeleton } from '../../components/ui/Skeleton';
import { managerZonePaths } from '../../config/managerPaths';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { buildAttentionItems, requestNeedsFeedback } from '../../lib/managerRequestHelpers';
import { formatMinutesUntil } from '../../lib/timeFormat';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest } from '../../types/serviceRequest';
import type { ServiceBooking } from '../../types/dashboard';

const paths = managerZonePaths(false);

function isToday(dateIso: string) {
  return new Date(dateIso).toDateString() === new Date().toDateString();
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
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof listContacts>>>([]);
  const [managerName, setManagerName] = useState('');
  const [managerKpi, setManagerKpi] = useState<ManagerKpi | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
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
        setError(null);
        const pendingFeedback = reqData.items.filter((item) => requestNeedsFeedback(item)).length;
        const slaBreached = reqData.items.filter((r) => r.slaBreached).length;
        setBadges({
          requests: reqData.items.filter((r) => r.status === 'NEW').length + slaBreached,
          contacts: contactsData.length,
          'ai-quality': pendingFeedback,
        });
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [setBadges],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useDashboardPolling(() => void load(true), 60_000);

  const metrics = useMemo(() => {
    const newCount = requests.filter((r) => r.status === 'NEW').length;
    const staleCount = requests.filter((r) => r.slaBreached).length;
    const todayBookings = bookings.filter((b) => isToday(b.preferredAt)).length;
    const pendingFeedback = requests.filter((item) => requestNeedsFeedback(item)).length;
    return { newCount, staleCount, todayBookings, pendingFeedback, contacts: contacts.length };
  }, [requests, bookings, contacts]);

  const attentionItems = useMemo(
    () => buildAttentionItems(requests, bookings, contacts, paths),
    [requests, bookings, contacts],
  );

  const upcomingBookings = useMemo(
    () =>
      [...bookings]
        .filter((b) => new Date(b.preferredAt).getTime() >= Date.now() - 3600000)
        .filter((b) => b.status !== 'CANCELLED')
        .sort((a, b) => new Date(a.preferredAt).getTime() - new Date(b.preferredAt).getTime())
        .slice(0, 6),
    [bookings],
  );

  const crmFailures = useMemo(() => activity.filter((a) => a.type === 'CRM_FAILED').length, [activity]);

  const greeting = useMemo(() => {
    const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    return date.charAt(0).toUpperCase() + date.slice(1);
  }, []);

  if (loading) {
    return (
      <div className="stack dashboard-page">
        <Skeleton className="skeleton-hero" />
        <div className="metrics-grid metrics-grid-4">
          <Skeleton className="skeleton-card" />
          <Skeleton className="skeleton-card" />
          <Skeleton className="skeleton-card" />
          <Skeleton className="skeleton-card" />
        </div>
        <Skeleton className="skeleton-block" />
        <Skeleton className="skeleton-block" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page manager-desk-page">
      <DashboardWelcomeHero
        icon={ClipboardList}
        greeting="Рабочий стол"
        title={managerName ? `Добро пожаловать, ${managerName}` : 'Сводка дня'}
        description={`${greeting}. ${
          attentionItems.length
            ? `${attentionItems.length} задач требуют внимания.`
            : 'Срочных действий сейчас нет.'
        }`}
        actions={
          <div className="desk-hero-actions">
            {lastRefresh ? (
              <span className="muted desk-refresh-hint tnum">
                Обновлено {lastRefresh.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <Button variant="ghost" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw size={16} aria-hidden className={refreshing ? 'is-spinning' : undefined} />
              Обновить
            </Button>
          </div>
        }
      />

      {metrics.contacts > 0 || crmFailures > 0 ? (
        <div className="desk-alert-row">
          {metrics.contacts > 0 ? (
            <Link to={paths.contacts} className="desk-alert desk-alert-info">
              <Inbox size={18} aria-hidden />
              <span>
                <strong className="tnum">{metrics.contacts}</strong> новых обращений с сайта
              </span>
            </Link>
          ) : null}
          {crmFailures > 0 ? (
            <button
              type="button"
              className="desk-alert desk-alert-danger"
              onClick={() =>
                document.getElementById('activity-feed')?.scrollIntoView({ block: 'center' })
              }
            >
              <AlertTriangle size={18} aria-hidden />
              <span>
                Ошибки передачи в CRM: <strong className="tnum">{crmFailures}</strong> — показать в ленте
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="metrics-grid metrics-grid-4">
        <Link to={`${paths.requests}?status=NEW`} className="kpi-bullet-link">
          <AnalyticsBulletChart label="Новые" value={metrics.newCount} max={10} hint="Цель ≤ 10" />
        </Link>
        <Link to={`${paths.requests}?sla=breached`} className="kpi-bullet-link">
          <AnalyticsBulletChart label="Просрочка SLA" value={metrics.staleCount} max={5} hint="Цель 0" />
        </Link>
        <Link to={paths.calendar} className="kpi-bullet-link">
          <AnalyticsBulletChart
            label="Сегодня в календаре"
            value={metrics.todayBookings}
            max={12}
            hint="Вместимость дня"
          />
        </Link>
        <Link to={paths.aiQuality} className="kpi-bullet-link">
          <AnalyticsBulletChart label="Ждут оценки ИИ" value={metrics.pendingFeedback} max={10} hint="Цель 0" />
        </Link>
      </div>

      <Card className="desk-priority-card">
        <header className="card-section-header">
          <h2>Сделать сейчас</h2>
          <Link to={paths.requests}>Вся очередь</Link>
        </header>
        <PriorityQueueList
          items={attentionItems}
          onOpenBooking={(bookingId) => {
            setSelectedBooking(bookings.find((x) => x.id === bookingId) || null);
          }}
          onStatusChanged={() => void load(true)}
        />
      </Card>

      <div className="grid two">
        <Card>
          <header className="card-section-header">
            <h2>Ближайшие записи</h2>
            <Link to={paths.calendar}>Календарь</Link>
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
            <EmptyState title="Нет записей" description="Запланированные записи появятся здесь." />
          )}
        </Card>

        <Card id="activity-feed">
          <header className="card-section-header">
            <h2>Лента активности</h2>
            <Link to={paths.requests}>Вся история</Link>
          </header>
          <ActivityFeed items={activity} requestBasePath={paths.requests} />
        </Card>
      </div>

      {managerKpi ? (
        <Card>
          <header className="card-section-header">
            <h2>Показатели за 7 дней</h2>
          </header>
          <ManagerKpiFunnel kpi={managerKpi} />
          <div className="manager-personal-kpi muted">
            <span>
              Мои активные: <strong className="tnum">{managerKpi.personal.activeRequests}</strong>
            </span>
            <span>
              Сообщений за период: <strong className="tnum">{managerKpi.personal.messagesSent}</strong>
            </span>
            <span>
              Конверсий входящих: <strong className="tnum">{managerKpi.personal.contactsConverted}</strong>
            </span>
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
        requestBasePath={paths.requests}
      />
    </div>
  );
}
