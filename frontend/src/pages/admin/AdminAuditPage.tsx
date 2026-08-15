import { useEffect, useMemo, useState } from 'react';
import { listAuditEvents } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { Select } from '../../components/ui/Select';
import { auditActionLabel, auditActionOptions, auditEntityLabel, auditEventDetail, auditEventsToCsv } from '../../lib/auditLabels';
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
  const [actorQuery, setActorQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    void listAuditEvents({
      action: actionFilter || undefined,
      entityType: entityFilter || undefined,
      from: from || undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
      limit: 200,
    })
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [actionFilter, entityFilter, from, to]);

  const actionOptions = useMemo(
    () => [{ value: '', label: 'Все действия' }, ...auditActionOptions()],
    [],
  );

  const visible = useMemo(() => {
    const q = actorQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const who = `${e.actor?.fullName || ''} ${e.actor?.email || ''} ${e.actorEmail || ''}`.toLowerCase();
      return who.includes(q);
    });
  }, [events, actorQuery]);

  function exportCsv() {
    const blob = new Blob([auditEventsToCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-events.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !events.length) return <Loader />;
  if (error && !events.length) return <ErrorState message={error} onRetry={() => void listAuditEvents({ limit: 200 }).then(setEvents)} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Журнал действий"
        description="Кто, что и когда изменил."
        actions={<Button variant="secondary" onClick={exportCsv} disabled={!visible.length}>Экспорт CSV</Button>}
      />

      <Card className="admin-toolbar">
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
        <Input
          value={actorQuery}
          onChange={(e) => setActorQuery(e.target.value)}
          placeholder="Кто (имя или email)"
          aria-label="Фильтр по автору"
        />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Дата с" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Дата по" />
      </Card>

      <Card>
        {!visible.length ? (
          <EmptyState title="Записей нет" description="Измените фильтры или выполните действие в админке." />
        ) : (
          <DataTable
            columns={[
              { key: 'when', label: 'Когда' },
              { key: 'who', label: 'Кто' },
              { key: 'what', label: 'Действие' },
              { key: 'entity', label: 'Сущность' },
              { key: 'detail', label: 'Детали' },
            ]}
            rows={visible.map((e) => ({
              when: e.createdAt ? new Date(e.createdAt).toLocaleString('ru-RU') : '—',
              who: e.actor?.fullName || e.actor?.email || e.actorEmail || 'Система',
              what: auditActionLabel(e.action),
              entity: auditEntityLabel(e.entityType),
              detail: auditEventDetail(e) || e.entityId || '—',
            }))}
          />
        )}
      </Card>
    </div>
  );
}
