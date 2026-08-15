import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAuditEvents, listRequestActivity, type ActivityItem } from '../../../api/dashboard';
import type { AuditEvent } from '../../../types/dashboard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { auditActionLabel, auditEntityLabel } from '../../../lib/auditLabels';
import { usePageMeta } from '../../../hooks/usePageMeta';

type FeedItem = {
  id: string;
  at: string;
  kind: 'audit' | 'ops';
  title: string;
  meta?: string;
  link?: string;
};

export function AdminTeamActivityPage() {
  usePageMeta({ title: 'Активность команды', description: 'Лента действий сотрудников и системы.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    void Promise.all([listAuditEvents({ limit: 80 }), listRequestActivity(40)])
      .then(([audit, activity]) => {
        const feed: FeedItem[] = [
          ...audit.map((e: AuditEvent) => ({
            id: `audit-${e.id}`,
            at: e.createdAt,
            kind: 'audit' as const,
            title: auditActionLabel(e.action),
            meta: auditEntityLabel(e.entityType),
          })),
          ...activity.items.map((e: ActivityItem) => ({
            id: `ops-${e.id}`,
            at: e.at,
            kind: 'ops' as const,
            title: e.title,
            meta: e.type,
            link: e.requestId ? `/dashboard/admin/operations/requests/${e.requestId}` : undefined,
          })),
        ];
        feed.sort((a, b) => b.at.localeCompare(a.at));
        setItems(feed.slice(0, 100));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const heatmap = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    for (const item of items) {
      const hour = new Date(item.at).getHours();
      buckets[hour] += 1;
    }
    const max = Math.max(...buckets, 1);
    return buckets.map((count, hour) => ({ hour, count, pct: Math.round((count / max) * 100) }));
  }, [items]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Активность команды"
        description="Заявки, feedback, правки CMS и действия администраторов."
      />

      <Card>
        <h2>Активность по часам</h2>
        <div className="activity-heatmap" aria-label="Heatmap активности по часам">
          {heatmap.map((cell) => (
            <div key={cell.hour} className="activity-heatmap-cell" title={`${cell.hour}:00 — ${cell.count}`}>
              <div className="activity-heatmap-bar" style={{ height: `${Math.max(6, cell.pct)}%` }} />
              <span>{cell.hour}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2>Лента событий</h2>
        {items.length ? (
        <ul className="activity-feed activity-feed-rich">
          {items.map((item) => (
            <li key={item.id} className={`is-${item.kind}`}>
              <time>{new Date(item.at).toLocaleString('ru-RU')}</time>
              {item.link ? (
                <Link to={item.link}>{item.title}</Link>
              ) : (
                <strong>{item.title}</strong>
              )}
              {item.meta ? <span className="muted">{item.meta}</span> : null}
            </li>
          ))}
        </ul>
        ) : (
          <EmptyState title="Событий пока нет" description="Действия команды появятся здесь." />
        )}
      </Card>
    </div>
  );
}
