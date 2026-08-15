import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAdminSessions, revokeAdminSession, type AdminSessionItem } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { RoleBadge } from '../../components/ui/RoleBadge';
import { useToast } from '../../components/ui/toastContext';
import { usePageMeta } from '../../hooks/usePageMeta';

function deviceLabel(session: AdminSessionItem) {
  return session.device?.label || session.ipLabel || 'Неизвестное устройство';
}

export function AdminSessionsPage() {
  usePageMeta({ title: 'Сессии', description: 'Активные входы сотрудников и клиентов.' });
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<AdminSessionItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setSessions(await listAdminSessions());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((item) => {
      const hay = `${item.user.fullName} ${item.user.email} ${deviceLabel(item)} ${item.ip || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, query]);

  async function revoke() {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      await revokeAdminSession(pending.id);
      success(pending.current ? 'Текущая сессия завершена' : 'Сессия завершена');
      setPending(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось завершить сессию';
      setActionError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !sessions.length) return <Loader label="Загружаем сессии…" />;
  if (loadError && !sessions.length) return <ErrorState message={loadError} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Сессии"
        description="Кто сейчас в системе. Можно принудительно завершить вход с конкретного устройства."
        actions={
          <Button variant="ghost" onClick={() => void load()}>
            Обновить
          </Button>
        }
      />

      {actionError ? <Alert kind="error">{actionError}</Alert> : null}

      <Card className="admin-toolbar">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени, email или устройству"
          aria-label="Поиск сессий"
        />
        <span className="muted-text tnum">{filtered.length} активных</span>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title="Активных сессий нет" description="После входа сотрудников они появятся здесь." />
        ) : (
          <ul className="admin-session-list">
            {filtered.map((session) => (
              <li key={session.id} className={session.current ? 'is-current' : undefined}>
                <div>
                  <strong>
                    {session.user.fullName}
                    {session.current ? <span className="admin-you-badge">Текущая</span> : null}
                  </strong>
                  <p className="muted-text">
                    {session.user.email} · <RoleBadge role={session.user.role} />
                  </p>
                  <p className="muted-text">
                    {deviceLabel(session)}
                    {session.ipLabel ? ` · ${session.ipLabel}` : ''}
                  </p>
                  <p className="muted-text tnum">
                    Вход {new Date(session.createdAt).toLocaleString('ru-RU')} · активность{' '}
                    {new Date(session.lastUsedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className="row gap-sm">
                  <Link to="/dashboard/admin/team/users" className="btn btn-ghost">
                    Пользователи
                  </Link>
                  <Button variant="ghost" onClick={() => setPending(session)} disabled={busy}>
                    Завершить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!pending}
        title="Завершить сессию?"
        text={
          pending
            ? pending.current
              ? 'Это ваш текущий вход. После подтверждения потребуется войти снова.'
              : `Завершить вход «${pending.user.fullName}» с устройства ${deviceLabel(pending)}?`
            : ''
        }
        confirmLabel="Завершить"
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => void revoke()}
      />
    </div>
  );
}
