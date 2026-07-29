import { useEffect, useMemo, useState } from 'react';
import { listAuditEvents } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Select } from '../../components/ui/Select';
import { resolveAdminBreadcrumbs } from '../../config/adminRoutes';
import { auditActionLabel, auditEntityLabel, auditEventDetail, auditEventsToCsv } from '../../lib/auditLabels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { AuditEvent } from '../../types/dashboard';

const ENTITY_OPTIONS = [
  { value: '', label: 'Все сущности' },
  { value: 'user', label: 'Пользователи' },
  { value: 'site_item', label: 'Контент сайта' },
  { value: 'site_content_block', label: 'Текстовые блоки' },
  { value: 'site_settings', label: 'Настройки сайта' },
  { value: 'integration_connection', label: 'Интеграции' },
  { value: 'service_request', label: 'Заявки' },
  { value: 'system', label: 'Система' },
];

export function AdminAuditPage() {
  usePageMeta({ title: 'Журнал действий', description: 'История изменений в системе.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    void listAuditEvents({
      action: actionFilter || undefined,
      entityType: entityFilter || undefined,
      limit: 200,
    })
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [actionFilter, entityFilter]);

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(events.map((e) => e.action))).sort();
    return [{ value: '', label: 'Все действия' }, ...unique.map((a) => ({ value: a, label: auditActionLabel(a) }))];
  }, [events]);

  function exportCsv() {
    const blob = new Blob([auditEventsToCsv(events)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-events.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Журнал действий"
        description="Кто, что и когда изменил."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/security/audit')}
        actions={<Button variant="secondary" onClick={exportCsv}>Экспорт CSV</Button>}
      />

      <Card className="filter-bar analytics-toolbar">
        <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} aria-label="Тип сущности">
          {ENTITY_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Действие">
          {actionOptions.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <DataTable
          columns={[
            { key: 'when', label: 'Когда' },
            { key: 'who', label: 'Кто' },
            { key: 'what', label: 'Действие' },
            { key: 'entity', label: 'Сущность' },
            { key: 'detail', label: 'Детали' },
          ]}
          rows={events.map((e) => ({
            when: e.createdAt ? new Date(e.createdAt).toLocaleString('ru-RU') : '—',
            who: e.actor?.fullName || e.actor?.email || e.actorEmail || 'Система',
            what: auditActionLabel(e.action),
            entity: auditEntityLabel(e.entityType),
            detail: auditEventDetail(e) || e.entityId || '—',
          }))}
        />
      </Card>
    </div>
  );
}
