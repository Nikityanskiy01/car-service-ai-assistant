import { useEffect, useState } from 'react';
import { blockUser, listAdminUsers, patchUserRole, unblockUser } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { RoleBadge } from '../../components/ui/RoleBadge';
import { Select } from '../../components/ui/Select';
import { resolveAdminBreadcrumbs } from '../../config/adminRoutes';
import { ROLE_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { AdminUser } from '../../types/dashboard';

const ROLE_HINTS: Record<AdminUser['role'], string> = {
  CLIENT: 'Доступ к личному кабинету и заявкам клиента.',
  MANAGER: 'Доступ к заявкам, клиентам и рабочему кабинету менеджера.',
  ADMINISTRATOR: 'Полный доступ к настройкам сайта, сотрудникам и интеграциям.',
};

export function AdminUsersPage() {
  usePageMeta({ title: 'Пользователи', description: 'Управление ролями и доступом.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingRole, setPendingRole] = useState<{ user: AdminUser; role: AdminUser['role'] } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listAdminUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function applyRole() {
    if (!pendingRole) return;
    await patchUserRole(pendingRole.user.id, pendingRole.role);
    setPendingRole(null);
    await load();
  }

  async function toggleBlock(user: AdminUser) {
    const admins = users.filter((u) => u.role === 'ADMINISTRATOR' && !u.blocked);
    if (user.role === 'ADMINISTRATOR' && !user.blocked && admins.length <= 1) {
      setError('Нельзя заблокировать последнего администратора.');
      return;
    }
    if (user.blocked) await unblockUser(user.id);
    else await blockUser(user.id);
    await load();
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Пользователи"
        description="Роли, блокировка и контроль доступа."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/team/users')}
      />

      <Card>
        {users.length === 0 ? (
          <EmptyState title="Пользователей нет" description="После регистрации список появится здесь." />
        ) : (
        <DataTable
          columns={[
            { key: 'fullName', label: 'Имя' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Роль' },
            { key: 'blocked', label: 'Статус' },
            { key: 'actions', label: 'Действия' },
          ]}
          rows={users.map((item) => ({
            fullName: item.fullName,
            email: item.email,
            role: <RoleBadge role={item.role} />,
            blocked: item.blocked ? 'Заблокирован' : 'Активен',
            actions: (
              <div className="row gap-sm">
                <Select
                  value={item.role}
                  onChange={(e) =>
                    setPendingRole({ user: item, role: e.target.value as AdminUser['role'] })
                  }
                  aria-label={`Роль ${item.fullName}`}
                >
                  {(['CLIENT', 'MANAGER', 'ADMINISTRATOR'] as const).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
                <Button variant="ghost" onClick={() => void toggleBlock(item)}>
                  {item.blocked ? 'Разблокировать' : 'Заблокировать'}
                </Button>
              </div>
            ),
          }))}
        />
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingRole}
        title="Изменить роль"
        text={
          pendingRole
            ? `Пользователь «${pendingRole.user.fullName}» получит роль «${ROLE_LABELS[pendingRole.role]}». ${ROLE_HINTS[pendingRole.role]}`
            : ''
        }
        onCancel={() => setPendingRole(null)}
        onConfirm={() => void applyRole()}
      />
    </div>
  );
}
