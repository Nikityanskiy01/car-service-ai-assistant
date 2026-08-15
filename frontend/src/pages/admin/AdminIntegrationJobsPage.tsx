import { useEffect, useMemo, useState } from 'react';
import {
  cancelIntegrationJob,
  listIntegrationJobs,
  listIntegrations,
  retryIntegrationJob,
} from '../../api/integrations';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
import { Loader } from '../../components/ui/Loader';
import { Select } from '../../components/ui/Select';
import { INTEGRATION_JOB_STATUS_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { IntegrationJob } from '../../types/integration';

type JobRow = IntegrationJob & { connectionName?: string };

const RETRYABLE = new Set(['FAILED', 'DEAD_LETTER', 'RETRYING']);
const CANCELLABLE = new Set(['PENDING', 'RETRYING', 'FAILED']);

export function AdminIntegrationJobsPage() {
  usePageMeta({ title: 'Очередь синхронизации', description: 'Задачи передачи данных во внешние системы.' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    void load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setSelected(new Set());
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
      setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const visibleIds = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visibleIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkRetry() {
    const ids = jobs.filter((j) => selected.has(j.id) && RETRYABLE.has(j.status)).map((j) => j.id);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => retryIntegrationJob(id)));
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ошибка повтора');
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkCancel() {
    const ids = jobs.filter((j) => selected.has(j.id) && CANCELLABLE.has(j.status)).map((j) => j.id);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => cancelIntegrationJob(id)));
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ошибка отмены');
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedRetryCount = jobs.filter((j) => selected.has(j.id) && RETRYABLE.has(j.status)).length;
  const selectedCancelCount = jobs.filter((j) => selected.has(j.id) && CANCELLABLE.has(j.status)).length;

  if (loading && !jobs.length) return <Loader />;
  if (loadError && !jobs.length) return <ErrorState message={loadError} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Очередь"
        description="Ожидающие, выполняемые и неуспешные задачи."
        actions={
          <div className="row gap-sm">
            <Button variant="secondary" disabled={!selectedRetryCount || bulkBusy} onClick={() => void bulkRetry()}>
              Повторить ({selectedRetryCount})
            </Button>
            <Button variant="ghost" disabled={!selectedCancelCount || bulkBusy} onClick={() => void bulkCancel()}>
              Отменить ({selectedCancelCount})
            </Button>
          </div>
        }
      />

      {actionError ? <Alert kind="error">{actionError}</Alert> : null}

      <Card className="filter-bar">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Статус задачи">
          <option value="">Все статусы</option>
          {['PENDING', 'PROCESSING', 'RETRYING', 'FAILED', 'DEAD_LETTER', 'SUCCEEDED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {INTEGRATION_JOB_STATUS_LABELS[s] || s}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        {!jobs.length ? (
          <EmptyState title="Задач нет" description="Очередь синхронизации пуста. Новые задачи появятся после обмена с CRM." />
        ) : (
        <ul className="job-list job-list-bulk">
          <li className="job-list-head">
            <label className="checkbox-row">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Выбрать все" />
              <span>Задача</span>
            </label>
          </li>
          {jobs.map((job) => (
            <li key={job.id}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.has(job.id)}
                  onChange={() => toggleOne(job.id)}
                  aria-label={`Выбрать задачу ${job.id}`}
                />
              </label>
              <IntegrationStatusBadge status={job.status} />
              <span>{INTEGRATION_JOB_STATUS_LABELS[job.status] || job.status}</span>
              <span>{job.connectionName}</span>
              <span>{job.entityType}</span>
              {job.lastErrorMessage ? <span className="danger">{job.lastErrorMessage}</span> : null}
              {RETRYABLE.has(job.status) ? (
                <Button variant="ghost" onClick={() => void retryIntegrationJob(job.id).then(load)}>
                  Повторить
                </Button>
              ) : null}
              {CANCELLABLE.has(job.status) ? (
                <Button variant="ghost" onClick={() => void cancelIntegrationJob(job.id).then(load)}>
                  Отменить
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        )}
      </Card>
    </div>
  );
}
