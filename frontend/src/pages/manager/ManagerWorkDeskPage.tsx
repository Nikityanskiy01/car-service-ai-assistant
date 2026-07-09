import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, MessageSquare, PlugZap } from 'lucide-react';
import { listBookings, listContacts, listServiceRequests } from '../../api/dashboard';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { ServiceRequestCard } from '../../components/requests/ServiceRequestCard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { useDashboardContext } from '../../components/layout/dashboard/useDashboardContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { managerQuickActions } from '../../config/dashboardNav';
import { formatRequestNumber } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ServiceRequest } from '../../types/serviceRequest';

function isToday(dateIso: string) {
  const d = new Date(dateIso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function ManagerWorkDeskPage() {
  usePageMeta({ title: 'Рабочий стол менеджера', description: 'Сводка дня и приоритетные обращения.' });
  const { setBadges } = useDashboardContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof listBookings>>>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof listContacts>>>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reqData, bookingsData, contactsData] = await Promise.all([
        listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }),
        listBookings(),
        listContacts(),
      ]);
      setRequests(reqData.items);
      setBookings(bookingsData);
      setContacts(contactsData);
      setBadges({
        requests: reqData.items.filter((r) => r.status === 'NEW').length,
        contacts: contactsData.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const newCount = requests.filter((r) => r.status === 'NEW').length;
    const inProgress = requests.filter((r) => r.status === 'IN_PROGRESS').length;
    const todayBookings = bookings.filter((b) => isToday(b.preferredAt));
    return { newCount, inProgress, todayBookings: todayBookings.length, contacts: contacts.length };
  }, [requests, bookings, contacts]);

  const attentionItems = useMemo(() => {
    const items: Array<{ id: string; title: string; reason: string; to: string }> = [];
    for (const r of requests) {
      if (r.status === 'NEW') {
        items.push({
          id: r.id,
          title: `Заявка №${formatRequestNumber(r.id)}`,
          reason: 'Новое обращение без ответа менеджера',
          to: `/dashboard/manager/requests/${r.id}`,
        });
      }
      if (r.status === 'IN_PROGRESS') {
        const hours = (Date.now() - new Date(r.createdAt).getTime()) / 3600000;
        if (hours > 4) {
          items.push({
            id: `${r.id}-stale`,
            title: `Заявка №${formatRequestNumber(r.id)}`,
            reason: `Без изменения статуса более ${Math.floor(hours)} ч.`,
            to: `/dashboard/manager/requests/${r.id}`,
          });
        }
      }
    }
    for (const b of bookings.filter((x) => isToday(x.preferredAt)).slice(0, 3)) {
      const diffMin = (new Date(b.preferredAt).getTime() - Date.now()) / 60000;
      if (diffMin > 0 && diffMin < 120) {
        items.push({
          id: b.id,
          title: b.client?.fullName || b.guestName || 'Запись',
          reason: `Визит через ${Math.round(diffMin)} мин.`,
          to: '/dashboard/manager/calendar',
        });
      }
    }
    return items.slice(0, 8);
  }, [requests, bookings]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const greeting = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Рабочий стол"
        description={`Сегодня — ${greeting}. Вот что требует вашего внимания.`}
        actions={
          <Button variant="ghost" onClick={() => void load()}>
            Обновить
          </Button>
        }
      />

      <section className="quick-actions" aria-label="Быстрые действия">
        {managerQuickActions.map((action) => (
          <Link key={action.to} to={action.to} className="quick-action-card">
            {action.label}
          </Link>
        ))}
      </section>

      <div className="metrics-grid">
        <Link to="/dashboard/manager/requests?status=NEW">
          <AnalyticsMetricCard label="Новые заявки" value={metrics.newCount} />
        </Link>
        <Link to="/dashboard/manager/requests?status=IN_PROGRESS">
          <AnalyticsMetricCard label="Требуют ответа" value={metrics.inProgress} />
        </Link>
        <Link to="/dashboard/manager/calendar">
          <AnalyticsMetricCard label="Записаны сегодня" value={metrics.todayBookings} />
        </Link>
        <Link to="/dashboard/manager/contacts">
          <AnalyticsMetricCard label="Обращения с сайта" value={metrics.contacts} />
        </Link>
      </div>

      <div className="grid two">
        <Card>
          <header className="card-section-header">
            <h2>
              <ClipboardList size={18} /> Требуют внимания
            </h2>
          </header>
          {attentionItems.length ? (
            <ul className="attention-list">
              {attentionItems.map((item) => (
                <li key={item.id}>
                  <Link to={item.to}>
                    <strong>{item.title}</strong>
                    <span>{item.reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Всё под контролем" description="Срочных действий сейчас нет." />
          )}
        </Card>

        <NotificationCenter
          items={contacts.slice(0, 5).map((item) => ({
            id: item.id,
            title: item.fullName,
            description: item.message || `Телефон: ${item.phone}`,
          }))}
        />
      </div>

      <Card>
        <header className="card-section-header">
          <h2>Последние заявки</h2>
          <Link to="/dashboard/manager/requests">Все заявки</Link>
        </header>
        <div className="stack">
          {requests.slice(0, 5).map((request) => (
            <Link key={request.id} to={`/dashboard/manager/requests/${request.id}`} className="request-card-link">
              <ServiceRequestCard request={request} />
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <header className="card-section-header">
          <h2>
            <CalendarClock size={18} /> Ближайшие записи
          </h2>
          <Link to="/dashboard/manager/calendar">Календарь</Link>
        </header>
        {bookings.length ? (
          <ul className="simple-list">
            {bookings.slice(0, 5).map((b) => (
              <li key={b.id}>
                <strong>{new Date(b.preferredAt).toLocaleString('ru-RU')}</strong>
                <span>{b.client?.fullName || b.guestName || 'Клиент'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Нет записей" description="Запланированные визиты появятся здесь." />
        )}
      </Card>

      <Card className="hint-card">
        <PlugZap size={18} />
        <div>
          <strong>Передача в учётную систему</strong>
          <p>Откройте заявку и на вкладке «Учётная система» передайте данные в подключённую CRM.</p>
        </div>
        <MessageSquare size={18} aria-hidden />
      </Card>
    </div>
  );
}
