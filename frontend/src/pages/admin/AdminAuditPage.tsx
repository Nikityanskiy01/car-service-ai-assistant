import { useEffect, useState } from 'react';
import { listAuditEvents } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { usePageMeta } from '../../hooks/usePageMeta';

function humanizeAudit(event: Record<string, unknown>): string {
  const action = String(event.action || '');
  if (action.includes('blocked')) return 'Администратор заблокировал пользователя.';
  if (action.includes('unblocked')) return 'Администратор разблокировал пользователя.';
  if (action.includes('role')) return 'Администратор изменил роль пользователя.';
  if (action.includes('CONNECTION')) return 'Изменены настройки интеграции.';
  return action || 'Действие в системе';
}

export function AdminAuditPage() {
  usePageMeta({ title: 'Журнал действий', description: 'История изменений в системе.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void listAuditEvents()
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader title="Журнал действий" description="Кто, что и когда изменил." />
      <Card>
        <DataTable
          columns={[
            { key: 'when', label: 'Когда' },
            { key: 'who', label: 'Кто' },
            { key: 'what', label: 'Действие' },
          ]}
          rows={events.slice(0, 100).map((e) => ({
            when: e.createdAt ? new Date(String(e.createdAt)).toLocaleString('ru-RU') : '—',
            who: String(e.actorEmail || e.actorId || 'Система'),
            what: humanizeAudit(e),
          }))}
        />
      </Card>
    </div>
  );
}
