import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllIntegrationConflicts, resolveIntegrationConflict } from '../../api/integrations';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { resolveAdminBreadcrumbs } from '../../config/adminRoutes';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { IntegrationConflict } from '../../types/integration';

const RESOLUTIONS = [
  { id: 'KEEP_LOCAL', label: 'Оставить локально' },
  { id: 'ACCEPT_EXTERNAL', label: 'Принять из CRM' },
  { id: 'MERGE', label: 'Слить' },
  { id: 'POSTPONE', label: 'Отложить' },
] as const;

export function AdminIntegrationConflictsPage() {
  usePageMeta({ title: 'Конфликты CRM', description: 'Несовпадения данных между сервисом и внешними системами.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<IntegrationConflict[]>([]);
  const [statusFilter, setStatusFilter] = useState<'open' | 'all'>('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setConflicts(await listAllIntegrationConflicts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const visible = useMemo(() => {
    if (statusFilter === 'all') return conflicts;
    return conflicts.filter((c) => c.status === 'OPEN');
  }, [conflicts, statusFilter]);

  async function resolve(conflictId: string, resolution: (typeof RESOLUTIONS)[number]['id']) {
    setBusyId(conflictId);
    try {
      await resolveIntegrationConflict(conflictId, resolution);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось разрешить конфликт');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Конфликты CRM"
        description="Inbox несогласованных полей между локальной базой и внешними системами."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/integrations/conflicts')}
        actions={
          <div className="row gap-sm">
            <Button variant={statusFilter === 'open' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('open')}>
              Открытые
            </Button>
            <Button variant={statusFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setStatusFilter('all')}>
              Все
            </Button>
          </div>
        }
      />

      {!visible.length ? (
        <EmptyState
          title="Конфликтов нет"
          description="Локальные и внешние данные синхронизированы."
        />
      ) : (
        <div className="conflicts-inbox">
          {visible.map((c) => (
            <Card key={c.id} className="conflict-inbox-card">
              <header className="conflict-inbox-head">
                <div>
                  <strong>{c.connectionName || 'Интеграция'}</strong>
                  <p className="muted">
                    {c.entityType} · {c.entityId} · поле <code>{c.fieldName}</code>
                  </p>
                </div>
                <span className={`conflict-status is-${c.status.toLowerCase()}`}>{c.status}</span>
              </header>
              <table className="conflicts-table">
                <thead>
                  <tr>
                    <th>Локально</th>
                    <th>Внешняя система</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{c.localValue || '—'}</td>
                    <td>{c.externalValue || '—'}</td>
                  </tr>
                </tbody>
              </table>
              <div className="row gap-sm conflict-inbox-actions">
                {RESOLUTIONS.map((r) => (
                  <Button
                    key={r.id}
                    variant="ghost"
                    disabled={busyId === c.id || c.status !== 'OPEN'}
                    onClick={() => void resolve(c.id, r.id)}
                  >
                    {r.label}
                  </Button>
                ))}
                <Link to={`/dashboard/admin/integrations/${c.connectionId}`}>
                  <Button variant="secondary">К подключению</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
