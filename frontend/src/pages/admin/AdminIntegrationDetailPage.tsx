import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  disableIntegration,
  enableIntegration,
  getIntegration,
  getIntegrationCapabilities,
  listIntegrationConflicts,
  listIntegrationJobs,
  syncIntegration,
  testIntegration,
} from '../../api/integrations';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
import { Loader } from '../../components/ui/Loader';
import { Tabs } from '../../components/ui/Tabs';
import { INTEGRATION_JOB_STATUS_LABELS, INTEGRATION_PROVIDER_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { IntegrationCapabilities, IntegrationConflict, IntegrationConnection, IntegrationJob } from '../../types/integration';

export function AdminIntegrationDetailPage() {
  const { connectionId = '' } = useParams();
  usePageMeta({ title: 'Подключение', description: 'Настройки и диагностика интеграции.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [capabilities, setCapabilities] = useState<IntegrationCapabilities | null>(null);
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [conflicts, setConflicts] = useState<IntegrationConflict[]>([]);
  const [tab, setTab] = useState('overview');
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionId) return;
    void load();
  }, [connectionId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [conn, caps, jobsData, conflictsData] = await Promise.all([
        getIntegration(connectionId),
        getIntegrationCapabilities(connectionId).catch(() => null),
        listIntegrationJobs(connectionId, { pageSize: 20 }).then((x) => x.items),
        listIntegrationConflicts(connectionId).catch(() => []),
      ]);
      setConnection(conn);
      setCapabilities(caps);
      setJobs(jobsData);
      setConflicts(conflictsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function runDiagnostics() {
    const out = await testIntegration(connectionId);
    setTestMsg(
      out.ok
        ? 'Все этапы проверки пройдены'
        : out.steps?.map((s) => `${s.ok ? '✓' : '✗'} ${s.name}${s.message ? `: ${s.message}` : ''}`).join('\n') ||
            out.message ||
            'Проверка не пройдена',
    );
  }

  if (loading) return <Loader />;
  if (error || !connection) return <ErrorState message={error || 'Подключение не найдено'} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={connection.name}
        description={INTEGRATION_PROVIDER_LABELS[connection.provider]}
        actions={
          <div className="row gap-sm">
            <Button variant="ghost" onClick={() => void runDiagnostics()}>
              Проверить подключение
            </Button>
            {connection.enabled ? (
              <Button variant="ghost" onClick={() => void disableIntegration(connectionId).then(load)}>
                Отключить
              </Button>
            ) : (
              <Button onClick={() => void enableIntegration(connectionId).then(load)}>Включить</Button>
            )}
            <Button variant="ghost" onClick={() => void syncIntegration(connectionId)}>
              Синхронизировать
            </Button>
          </div>
        }
      />

      <Card className="request-summary-bar">
        <IntegrationStatusBadge status={connection.status} />
        <span>{connection.enabled ? 'Активно' : 'Выключено'}</span>
        {connection.lastSyncAt ? <span>Последняя синхронизация: {new Date(connection.lastSyncAt).toLocaleString('ru-RU')}</span> : null}
      </Card>

      {testMsg ? <pre className="diagnostic-output">{testMsg}</pre> : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'capabilities', label: 'Возможности' },
          { id: 'queue', label: 'Очередь' },
          { id: 'conflicts', label: 'Конфликты' },
        ]}
      />

      {tab === 'overview' && (
        <Card>
          <h2>Настройки</h2>
          <p>Режим: {connection.mode}</p>
          {connection.versionLabel ? <p>Версия: {connection.versionLabel}</p> : null}
          {connection.credentials?.length ? (
            <ul>
              {connection.credentials.map((c) => (
                <li key={c.key}>
                  {c.key}: {c.maskedValue}
                </li>
              ))}
            </ul>
          ) : null}
          {connection.lastErrorMessage ? <p className="danger">{connection.lastErrorMessage}</p> : null}
        </Card>
      )}

      {tab === 'capabilities' && (
        <Card>
          {capabilities ? (
            <ul className="capabilities-list">
              {Object.entries(capabilities).map(([key, value]) => (
                <li key={key}>
                  <span>{key}</span>
                  <strong>{value ? 'Да' : 'Нет'}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Возможности будут доступны после проверки подключения.</p>
          )}
        </Card>
      )}

      {tab === 'queue' && (
        <Card>
          <Link to="/dashboard/admin/integrations/jobs">Вся очередь</Link>
          <ul className="simple-list">
            {jobs.map((job) => (
              <li key={job.id}>
                <span>{INTEGRATION_JOB_STATUS_LABELS[job.status] || job.status}</span>
                <span>{job.entityType}</span>
                {job.lastErrorMessage ? <span className="danger">{job.lastErrorMessage}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'conflicts' && (
        <Card>
          {!conflicts.length ? (
            <p>Локальные и внешние данные синхронизированы.</p>
          ) : (
            <table className="conflicts-table">
              <thead>
                <tr>
                  <th>Поле</th>
                  <th>Локально</th>
                  <th>Внешняя система</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.fieldName}</td>
                    <td>{c.localValue || '—'}</td>
                    <td>{c.externalValue || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
