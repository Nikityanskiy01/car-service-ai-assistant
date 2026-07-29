import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import type { UserRole } from '../../types/auth';

const ROLE_AREAS: Array<{ role: UserRole; label: string; to: string }> = [
  { role: 'CLIENT', label: 'Клиент', to: '/dashboard/client' },
  { role: 'MANAGER', label: 'Менеджер', to: '/dashboard/manager' },
  { role: 'ADMINISTRATOR', label: 'Админ', to: '/dashboard/admin' },
];

export function RoleSwitcher() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const available = ROLE_AREAS.filter((area) => {
    if (area.role === 'CLIENT') return true;
    if (area.role === 'MANAGER') return user.role === 'MANAGER' || user.role === 'ADMINISTRATOR';
    if (area.role === 'ADMINISTRATOR') return user.role === 'ADMINISTRATOR';
    return false;
  });

  if (available.length <= 1) return null;

  const active =
    location.pathname.startsWith('/dashboard/admin')
      ? '/dashboard/admin'
      : location.pathname.startsWith('/dashboard/manager')
        ? '/dashboard/manager'
        : '/dashboard/client';

  return (
    <nav className="role-switcher" aria-label="Переключение кабинета">
      {available.map((area) => (
        <Link
          key={area.role}
          to={area.to}
          className={`role-switcher-link${active === area.to ? ' active' : ''}`}
        >
          {area.label}
        </Link>
      ))}
    </nav>
  );
}
