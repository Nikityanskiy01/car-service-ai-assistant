import { useEffect, useState } from 'react';
import { listIntegrationJobs, listIntegrations, retryIntegrationJob } from '../../api/integrations';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
import { Loader } from '../../components/ui/Loader';
import { Select } from '../../components/ui/Select';
import { INTEGRATION_JOB_STATUS_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { IntegrationJob } from '../../types/integration';

export function AdminIntegrationJobsPage() {
  usePageMeta({ title: 'Очередь синхронизации', description: 'Задачи передачи данных во внешние системы.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Array<IntegrationJob & { connectionName?: string }>>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    void load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const connections = await listIntegrations();
      const allJobs = await Promise.all(
        connections.map(async (c) => {
          const data = await listIntegrationJobs(c.id, {
            status: statusFilter || undefined,
            pageSize: 50,
          });
          return data.items.map((j) => ({ ...j, connectionName: c.name }));
        }),
      );
      setJobs(allJobs.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Очередь синхронизации"
        description="Ожидающие, выполняемые и неуспешные задачи."
        breadcrumbs={[
          { label: 'Интеграции', to: '/dashboard/admin/integrations' },
          { label: 'Очередь' },
        ]}
      />

      <Card className="filter-bar">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Статус задачи">
          <option value="">Все статусы</option>
          {['PENDING', 'PROCESSING', 'RETRYING', 'FAILED', 'DEAD_LETTER', 'SUCCEEDED'].map((s) => (
            <option key={s} value={s}>
              {INTEGRATION_JOB_STATUS_LABELS[s] || s}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <IntegrationStatusBadge status={job.status} />
              <span>{INTEGRATION_JOB_STATUS_LABELS[job.status]}</span>
              <span>{job.connectionName}</span>
              <span>{job.entityType}</span>
              {job.lastErrorMessage ? <span className="danger">{job.lastErrorMessage}</span> : null}
              {['FAILED', 'DEAD_LETTER', 'RETRYING'].includes(job.status) ? (
                <Button variant="ghost" onClick={() => void retryIntegrationJob(job.id).then(load)}>
                  Повторить
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
