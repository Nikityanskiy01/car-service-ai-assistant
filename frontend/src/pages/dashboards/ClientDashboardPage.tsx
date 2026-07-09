import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { ErrorState } from '../../components/ui/ErrorState';
import { usePageMeta } from '../../hooks/usePageMeta';

type ConsultationRow = { id: string; status: string; createdAt: string };
type RequestRow = { id: string; status: string; version: number; createdAt: string; snapshotMake?: string; snapshotModel?: string };
type BookingRow = { id: string; status: string; preferredAt: string; createdAt: string };

export function ClientDashboardPage() {
  usePageMeta({
    title: 'Кабинет клиента',
    description: 'Отслеживание консультаций, заявок, записей и сообщений менеджера.',
  });
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [me, consultationsData, requestsData, bookingsData] = await Promise.all([
          api<Record<string, unknown>>('/users/me'),
          api<ConsultationRow[]>('/consultations'),
          api<{ items: RequestRow[] }>('/service-requests'),
          api<BookingRow[]>('/bookings'),
        ]);
        setProfile(me);
        setConsultations(consultationsData);
        setRequests(requestsData.items || []);
        setBookings(bookingsData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки кабинета');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack">
      <h1>Кабинет клиента</h1>
      <div className="metrics-grid">
        <AnalyticsMetricCard label="Активные заявки" value={requests.filter((r) => r.status !== 'COMPLETED').length} />
        <AnalyticsMetricCard label="Консультации" value={consultations.length} />
        <AnalyticsMetricCard label="Записи" value={bookings.length} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'profile', label: 'Профиль' },
          { id: 'consultations', label: 'Консультации' },
          { id: 'requests', label: 'Заявки' },
          { id: 'bookings', label: 'Записи' },
        ]}
      />

      {tab === 'profile' && (
        <div className="grid two">
          <Card>
            <h2>Профиль</h2>
            <pre className="json">{JSON.stringify(profile, null, 2)}</pre>
          </Card>
          <NotificationCenter
            items={[
              {
                id: 'n-1',
                title: 'Рекомендуется продолжить консультацию',
                description: 'Система готова уточнить детали по текущему обращению.',
              },
              {
                id: 'n-2',
                title: 'Доступна новая запись',
                description: 'Проверьте ближайшие окна в разделе записей.',
              },
            ]}
          />
        </div>
      )}

      {tab === 'consultations' && (
        <Card>
          <h2>История консультаций</h2>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'status', label: 'Статус' },
              { key: 'createdAt', label: 'Создана' },
            ]}
            rows={consultations.map((item) => ({
              id: item.id.slice(0, 8),
              status: <StatusBadge status={item.status} />,
              createdAt: new Date(item.createdAt).toLocaleString(),
            }))}
          />
        </Card>
      )}

      {tab === 'requests' && (
        <Card>
          <h2>Сервисные заявки</h2>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'status', label: 'Статус' },
              { key: 'car', label: 'Авто' },
              { key: 'createdAt', label: 'Создана' },
            ]}
            rows={requests.map((item) => ({
              id: item.id.slice(0, 8),
              status: <StatusBadge status={item.status} />,
              car: `${item.snapshotMake || ''} ${item.snapshotModel || ''}`.trim() || '—',
              createdAt: new Date(item.createdAt).toLocaleString(),
            }))}
          />
        </Card>
      )}

      {tab === 'bookings' && (
        <Card>
          <h2>Записи на обслуживание</h2>
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'status', label: 'Статус' },
              { key: 'preferredAt', label: 'Желаемое время' },
              { key: 'createdAt', label: 'Создана' },
            ]}
            rows={bookings.map((item) => ({
              id: item.id.slice(0, 8),
              status: <StatusBadge status={item.status} />,
              preferredAt: new Date(item.preferredAt).toLocaleString(),
              createdAt: new Date(item.createdAt).toLocaleString(),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
