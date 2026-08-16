import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
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
import { WorkdeskRail } from '../../components/manager/workdesk/WorkdeskRail';
import { BookingDrawer } from '../../components/requests/BookingDrawer';
import { useDashboardContext } from '../../components/layout/dashboard/useDashboardContext';
import { PriorityQueueList } from '../../components/requests/PriorityQueueList';
import { Button } from '../../components/ui/Button';
import { managerZonePaths } from '../../config/managerPaths';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import {
  buildAttentionItems,
  requestNeedsFeedback,
  type AttentionKind,
} from '../../lib/managerRequestHelpers';
import { SLA_OVERDUE_HINT, SLA_OVERDUE_SHORT } from '../../lib/requestSla';
import { formatMinutesUntil } from '../../lib/timeFormat';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest } from '../../types/serviceRequest';
import type { ServiceBooking } from '../../types/dashboard';

const paths = managerZonePaths(false);

type QueueFilter = 'all' | 'requests' | 'site' | 'ai';

const QUEUE_FILTERS: { id: QueueFilter; label: string; kinds: AttentionKind[] }[] = [
  { id: 'all', label: 'Все', kinds: ['sla', 'request', 'stale', 'feedback', 'contact'] },
  { id: 'requests', label: 'Заявки', kinds: ['sla', 'request', 'stale'] },
  { id: 'site', label: 'Сообщения с сайта', kinds: ['contact'] },
  { id: 'ai', label: 'ИИ', kinds: ['feedback'] },
];

function isToday(dateIso: string) {
  return new Date(dateIso).toDateString() === new Date().toDateString();
}

function shiftDateLabel() {
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  return date.charAt(0).toUpperCase() + date.slice(1);
}

export function ManagerWorkDeskPage() {
  usePageMeta({ title: 'Рабочий стол менеджера', description: 'Очередь смены и ближайшие записи.' });
  const { setBadges } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof listContacts>>>([]);
  const [managerName, setManagerName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [managerKpi, setManagerKpi] = useState<ManagerKpi | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');

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
        setManagerId(profile?.id || '');
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
    const inProgress = requests.filter((r) => r.status === 'IN_PROGRESS').length;
    const scheduled = requests.filter((r) => r.status === 'SCHEDULED').length;
    const mine = managerId
      ? requests.filter(
          (r) =>
            r.assignedManagerId === managerId &&
            (r.status === 'NEW' || r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED'),
        ).length
      : 0;
    const todayBookings = bookings.filter((b) => isToday(b.preferredAt) && b.status !== 'CANCELLED');
    const todayWaiting = todayBookings.filter((b) => b.status === 'PENDING').length;
    const pendingFeedback = requests.filter((item) => requestNeedsFeedback(item)).length;
    return {
      newCount,
      staleCount,
      inProgress,
      scheduled,
      mine,
      todayBookings,
      todayWaiting,
      pendingFeedback,
      contacts: contacts.length,
    };
  }, [requests, bookings, contacts, managerId]);

  const attentionItems = useMemo(
    () => buildAttentionItems(requests, bookings, contacts, paths),
    [requests, bookings, contacts],
  );

  const deskItems = useMemo(
    () => attentionItems.filter((item) => item.kind !== 'booking'),
    [attentionItems],
  );

  const visibleItems = useMemo(() => {
    const kinds = QUEUE_FILTERS.find((filter) => filter.id === queueFilter)?.kinds;
    if (!kinds) return deskItems;
    return deskItems.filter((item) => kinds.includes(item.kind));
  }, [deskItems, queueFilter]);

  const filterCounts = useMemo(() => {
    const counts: Record<QueueFilter, number> = { all: deskItems.length, requests: 0, site: 0, ai: 0 };
    for (const item of deskItems) {
      if (item.kind === 'sla' || item.kind === 'request' || item.kind === 'stale') counts.requests += 1;
      if (item.kind === 'contact') counts.site += 1;
      if (item.kind === 'feedback') counts.ai += 1;
    }
    return counts;
  }, [deskItems]);

  const todayBookings = useMemo(
    () =>
      [...metrics.todayBookings].sort(
        (a, b) => new Date(a.preferredAt).getTime() - new Date(b.preferredAt).getTime(),
      ),
    [metrics.todayBookings],
  );

  const nextBooking = useMemo(() => {
    const now = Date.now() - 20 * 60_000;
    return todayBookings.find((booking) => new Date(booking.preferredAt).getTime() >= now) || null;
  }, [todayBookings]);

  const crmFailures = useMemo(() => activity.filter((a) => a.type === 'CRM_FAILED').length, [activity]);
  const greeting = useMemo(() => shiftDateLabel(), []);

  const shiftStatus = useMemo(() => {
    const parts: string[] = [];
    if (deskItems.length) parts.push(`${deskItems.length} к действию`);
    else parts.push('Очередь спокойная');
    if (nextBooking) parts.push(`следующая запись ${formatMinutesUntil(nextBooking.preferredAt)}`);
    else if (todayBookings.length) parts.push(`${todayBookings.length} записей сегодня`);
    return parts.join(', ');
  }, [deskItems.length, nextBooking, todayBookings.length]);

  const queueDanger = visibleItems.some((item) => item.kind === 'sla' || item.kind === 'stale');

  if (loading) {
    return (
      <div className="workdesk" aria-busy="true">
        <div className="skeleton workdesk-skel-shift" />
        <div className="workdesk-signals">
          <div className="workdesk-signals-row is-action">
            <div className="skeleton workdesk-signal" />
            <div className="skeleton workdesk-signal" />
            <div className="skeleton workdesk-signal" />
            <div className="skeleton workdesk-signal" />
          </div>
          <div className="workdesk-signals-row is-shift">
            <div className="skeleton workdesk-signal" />
            <div className="skeleton workdesk-signal" />
            <div className="skeleton workdesk-signal" />
            <div className="skeleton workdesk-signal" />
          </div>
        </div>
        <div className="skeleton workdesk-skel-queue" />
      </div>
    );
  }

  return (
    <div className={`workdesk${refreshing ? ' is-refreshing' : ''}`}>
      <header className="workdesk-shift">
        <div className="workdesk-shift-copy">
          <h1>Смена{managerName ? `, ${managerName}` : ''}</h1>
          <p className="workdesk-shift-meta">{greeting}</p>
          <p className="workdesk-shift-status">{shiftStatus}</p>
        </div>
        <div className="workdesk-shift-tools">
          {lastRefresh ? (
            <span className="muted">
              {lastRefresh.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : undefined} />
            Обновить
          </Button>
        </div>
      </header>

      {error ? (
        <div className="error-text" role="alert">
          <p>Не удалось загрузить рабочий стол. {error}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Повторить
          </Button>
        </div>
      ) : null}

      <nav className="workdesk-signals" aria-label="Показатели смены">
        <div className="workdesk-signals-row is-action" aria-label="Требуют действия">
          <Signal
            to={`${paths.requests}?sla=breached`}
            value={metrics.staleCount}
            label={SLA_OVERDUE_SHORT}
            hint={SLA_OVERDUE_HINT}
            tone={metrics.staleCount > 0 ? 'hot' : 'quiet'}
          />
          <Signal
            to={`${paths.requests}?status=NEW`}
            value={metrics.newCount}
            label="Новые"
            hint="ещё не взяли"
            tone={metrics.newCount > 0 ? 'accent' : 'quiet'}
          />
          <Signal
            to={paths.contacts}
            value={metrics.contacts}
            label="Сообщения с сайта"
            hint="форма на сайте"
            tone={metrics.contacts > 0 ? 'accent' : 'quiet'}
          />
          <Signal
            to={paths.aiQuality}
            value={metrics.pendingFeedback}
            label="Оценка ИИ"
            hint="ждут оценки"
            tone={metrics.pendingFeedback > 0 ? 'warn' : 'quiet'}
          />
          {crmFailures > 0 ? (
            <Signal to={paths.requests} value={crmFailures} label="CRM" hint="сбой выгрузки" tone="hot" />
          ) : null}
        </div>
        <div className="workdesk-signals-row is-shift" aria-label="Снимок смены">
          <Signal
            to={`${paths.requests}?status=IN_PROGRESS`}
            value={metrics.inProgress}
            label="В работе"
            hint="заявки"
          />
          <Signal
            to={`${paths.requests}?status=SCHEDULED`}
            value={metrics.scheduled}
            label="Записи"
            hint="назначены"
          />
          <Signal
            to={`${paths.requests}?scope=mine`}
            value={metrics.mine || managerKpi?.personal.activeRequests || 0}
            label="Мои"
            hint="на мне"
          />
          <Signal
            to={paths.calendar}
            value={todayBookings.length}
            label="Сегодня"
            hint={metrics.todayWaiting ? `${metrics.todayWaiting} ждут` : 'в календаре'}
          />
          {managerKpi ? (
            <>
              <Signal
                to={`${paths.requests}?status=COMPLETED`}
                value={managerKpi.funnel.completedRequests}
                label="Готово"
                hint={`за ${managerKpi.periodDays} дн.`}
                tone={managerKpi.funnel.completedRequests > 0 ? 'ok' : 'quiet'}
              />
              <Signal
                to={paths.requests}
                value={managerKpi.funnel.conversionCompleted}
                suffix="%"
                label="Доля закрытых"
                hint="заявка → готово"
              />
            </>
          ) : null}
        </div>
      </nav>

      <div className="workdesk-grid">
        <section className="workdesk-queue" aria-labelledby="workdesk-queue-title">
          <div className="workdesk-queue-head">
            <h2 id="workdesk-queue-title" className="workdesk-queue-title">
              Очередь смены
              <span className={`workdesk-count${queueDanger ? ' is-danger' : ''}`}>{visibleItems.length}</span>
            </h2>
            <div className="workdesk-filters" role="toolbar" aria-label="Фильтр очереди">
              {QUEUE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className="workdesk-filter"
                  aria-pressed={queueFilter === filter.id}
                  onClick={() => setQueueFilter(filter.id)}
                >
                  {filter.label}
                  <span>{filterCounts[filter.id]}</span>
                </button>
              ))}
            </div>
            <Link className="workdesk-queue-all" to={paths.requests}>
              Вся очередь
            </Link>
          </div>
          <PriorityQueueList
            items={visibleItems}
            emptyTitle={queueFilter === 'all' ? 'Очередь пуста' : 'В этом срезе пусто'}
            emptyDescription={
              queueFilter === 'all'
                ? 'Можно разобрать календарь или оценки ИИ.'
                : 'Переключите фильтр или откройте полный список заявок.'
            }
            emptyAction={
              <Link className="btn btn-secondary" to={queueFilter === 'ai' ? paths.aiQuality : paths.requests}>
                {queueFilter === 'ai' ? 'К оценкам ИИ' : 'К заявкам'}
              </Link>
            }
            onOpenBooking={(bookingId) => {
              setSelectedBooking(bookings.find((x) => x.id === bookingId) || null);
            }}
            onStatusChanged={() => void load(true)}
          />
        </section>

        <WorkdeskRail
          nextBooking={nextBooking}
          todayBookings={todayBookings}
          activity={activity}
          crmFailures={crmFailures}
          managerKpi={managerKpi}
          calendarPath={paths.calendar}
          requestsPath={paths.requests}
          onOpenBooking={setSelectedBooking}
        />
      </div>

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

function Signal({
  to,
  value,
  label,
  hint,
  tone = 'quiet',
  suffix,
}: {
  to: string;
  value: number;
  label: string;
  hint: string;
  tone?: 'quiet' | 'hot' | 'accent' | 'warn' | 'ok';
  suffix?: string;
}) {
  return (
    <Link to={to} className={`workdesk-signal is-${tone}`}>
      <strong>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
      <span className="workdesk-signal-copy">
        <span className="workdesk-signal-label">{label}</span>
        <span className="workdesk-signal-hint">{hint}</span>
      </span>
    </Link>
  );
}
