import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listServiceRequests } from '../../../api/dashboard';
import { DashboardRecordCard } from '../../../components/dashboard/DashboardRecordCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import { usePageMeta } from '../../../hooks/usePageMeta';
import type { ServiceRequest } from '../../../types/serviceRequest';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientRequestsPage() {
  usePageMeta({ title: 'Мои заявки', description: 'Сервисные заявки и их статусы.' });
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' });
        setRequests(data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки заявок');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = requests.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const archive = requests.filter((r) => r.status === 'COMPLETED' || r.status === 'CANCELLED');
  const shown = tab === 'active' ? active : archive;

  if (loading) return <Loader label="Загружаем заявки..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Мои заявки"
        description="Отслеживайте статус обращений и переписку с менеджером."
        breadcrumbs={[
          { label: 'Кабинет', to: '/dashboard/client' },
          { label: 'Заявки' },
        ]}
        actions={
          <Link className="btn btn-primary" to="/consult">
            Новая консультация
          </Link>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'active', label: `Активные (${active.length})` },
          { id: 'archive', label: `Архив (${archive.length})` },
        ]}
      />

      <Card>
        {shown.length === 0 ? (
          <EmptyState
            title={tab === 'active' ? 'Нет активных заявок' : 'Архив пуст'}
            description={
              tab === 'active'
                ? 'После ИИ-консультации можно передать обращение менеджеру.'
                : 'Завершённые и отменённые заявки появятся здесь.'
            }
          />
        ) : (
          <div className="desk-record-list">
            {shown.map((item) => (
              <DashboardRecordCard
                key={item.id}
                title={[item.snapshotMake, item.snapshotModel].filter(Boolean).join(' ') || `Заявка ${item.id.slice(0, 8)}`}
                subtitle={item.snapshotSymptoms || 'Без описания симптомов'}
                meta={formatDate(item.createdAt)}
                status={item.status}
                icon={ClipboardList}
                to={`/dashboard/client/requests/${item.id}`}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
