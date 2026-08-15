import { useEffect, useMemo, useState } from 'react';
import {
  blockUser,
  listAdminUsers,
  patchUserRole,
  revokeUserSessions,
  unblockUser,
} from '../../api/dashboard';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { RoleBadge } from '../../components/ui/RoleBadge';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/toastContext';
import { ROLE_LABELS } from '../../lib/labels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { AdminUser } from '../../types/dashboard';

const ROLE_HINTS: Record<AdminUser['role'], string> = {
  CLIENT: 'Доступ к личному кабинету и заявкам клиента.',
  MANAGER: 'Доступ к заявкам, клиентам и рабочему кабинету менеджера.',
  ADMINISTRATOR: 'Полный доступ к настройкам сайта, сотрудникам и интеграциям.',
};

type PendingAction =
  | { kind: 'role'; user: AdminUser; role: AdminUser['role'] }
  | { kind: 'block'; user: AdminUser }
  | { kind: 'kick'; user: AdminUser };

function isLastActiveAdmin(users: AdminUser[], user: AdminUser) {
  if (user.role !== 'ADMINISTRATOR' || user.blocked) return false;
  return users.filter((item) => item.role === 'ADMINISTRATOR' && !item.blocked).length <= 1;
}

export function AdminUsersPage() {
  usePageMeta({ title: 'Пользователи', description: 'Управление ролями и доступом.' });
  const { user: me } = useAuth();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listAdminUsers());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return users.filter((item) => {
      if (roleFilter && item.role !== roleFilter) return false;
      if (statusFilter === 'active' && item.blocked) return false;
      if (statusFilter === 'blocked' && !item.blocked) return false;
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q)
      );
    });
  }, [users, debouncedQuery, roleFilter, statusFilter]);

  function requestRoleChange(user: AdminUser, role: AdminUser['role']) {
    setActionError(null);
    if (role === user.role) return;
    if (isLastActiveAdmin(users, user) && role !== 'ADMINISTRATOR') {
      setActionError('Нельзя снять роль с последнего администратора.');
      return;
    }
    setPending({ kind: 'role', user, role });
  }

  function requestBlock(user: AdminUser) {
    setActionError(null);
    if (!user.blocked && isLastActiveAdmin(users, user)) {
      setActionError('Нельзя заблокировать последнего администратора.');
      return;
    }
    setPending({ kind: 'block', user });
  }

  async function applyPending() {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'role') {
        await patchUserRole(pending.user.id, pending.role);
        success(`Роль обновлена: ${ROLE_LABELS[pending.role]}`);
      } else if (pending.kind === 'block') {
        if (pending.user.blocked) await unblockUser(pending.user.id);
        else await blockUser(pending.user.id);
        success(pending.user.blocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован');
      } else {
        const out = await revokeUserSessions(pending.user.id);
        success(`Завершено сессий: ${out.revoked}`);
      }
      setPending(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось выполнить действие';
      setActionError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !users.length) return <Loader label="Загружаем пользователей…" />;
  if (loadError && !users.length) return <ErrorState message={loadError} onRetry={() => void load()} />;

  const confirmTitle =
    pending?.kind === 'role'
      ? 'Изменить роль'
      : pending?.kind === 'kick'
        ? 'Завершить сессии'
        : pending?.user.blocked
          ? 'Разблокировать'
          : 'Заблокировать';
  const confirmText = pending
    ? pending.kind === 'role'
      ? `Пользователь «${pending.user.fullName}» получит роль «${ROLE_LABELS[pending.role]}». ${ROLE_HINTS[pending.role]}`
      : pending.kind === 'kick'
        ? `Все активные сессии «${pending.user.fullName}» будут завершены. Сотрудник войдёт заново.`
        : pending.user.blocked
          ? `Разблокировать «${pending.user.fullName}»?`
          : `Заблокировать «${pending.user.fullName}»? Доступ будет закрыт сразу.`
    : '';

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Пользователи"
        description="Роли, блокировка и сессии. Новый сотрудник регистрируется сам, затем вы назначаете роль."
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
          placeholder="Поиск по имени, email или телефону"
          aria-label="Поиск пользователей"
        />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Роль">
          <option value="">Все роли</option>
          <option value="ADMINISTRATOR">{ROLE_LABELS.ADMINISTRATOR}</option>
          <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
          <option value="CLIENT">{ROLE_LABELS.CLIENT}</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Статус">
          <option value="">Все статусы</option>
          <option value="active">Активны</option>
          <option value="blocked">Заблокированы</option>
        </Select>
        <span className="muted-text tnum">{filtered.length} из {users.length}</span>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={users.length ? 'Никого не нашли' : 'Пользователей нет'}
            description={users.length ? 'Сбросьте фильтры или измените запрос.' : 'После регистрации список появится здесь.'}
          />
        ) : (
          <DataTable
            columns={[
              { key: 'fullName', label: 'Имя' },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Роль' },
              { key: 'blocked', label: 'Статус' },
              { key: 'actions', label: 'Действия' },
            ]}
            rows={filtered.map((item) => {
              const isMe = item.id === me?.id;
              const lastAdmin = isLastActiveAdmin(users, item);
              return {
                fullName: (
                  <span className="admin-user-name">
                    {item.fullName}
                    {isMe ? <span className="admin-you-badge">Вы</span> : null}
                  </span>
                ),
                email: item.email,
                role: <RoleBadge role={item.role} />,
                blocked: item.blocked ? 'Заблокирован' : 'Активен',
                actions: (
                  <div className="row gap-sm admin-user-actions">
                    <Select
                      value={item.role}
                      onChange={(e) => requestRoleChange(item, e.target.value as AdminUser['role'])}
                      aria-label={`Роль ${item.fullName}`}
                      disabled={lastAdmin && item.role === 'ADMINISTRATOR'}
                    >
                      {(['CLIENT', 'MANAGER', 'ADMINISTRATOR'] as const).map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost"
                      onClick={() => requestBlock(item)}
                      disabled={lastAdmin && !item.blocked}
                    >
                      {item.blocked ? 'Разблокировать' : 'Заблокировать'}
                    </Button>
                    <Button variant="ghost" onClick={() => setPending({ kind: 'kick', user: item })}>
                      Сессии
                    </Button>
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!pending}
        title={confirmTitle}
        text={confirmText}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => void applyPending()}
      />
    </div>
  );
}
