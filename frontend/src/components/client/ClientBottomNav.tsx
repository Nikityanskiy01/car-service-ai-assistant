import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';

type Props = {
  unreadCases?: number;
};

const MAIN_ITEMS = [
  { id: 'home', label: 'Главная', to: '/dashboard/client', icon: LayoutDashboard, end: true },
  { id: 'cases', label: 'Обращения', to: '/dashboard/client/cases', icon: ClipboardList },
  { id: 'bookings', label: 'Записи', to: '/dashboard/client/bookings', icon: CalendarDays },
] as const;

export function ClientBottomNav({ unreadCases = 0 }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(path: string, end = false) {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  }

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className="client-bottom-nav-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}
      <nav className="client-bottom-nav" aria-label="Мобильная навигация">
        {MAIN_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = item.id === 'cases' ? unreadCases : 0;
          const active = isActive(item.to, 'end' in item ? item.end : false);
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`client-bottom-nav-item${active ? ' is-active' : ''}`}
              onClick={() => setMoreOpen(false)}
            >
              <span className="client-bottom-nav-icon" aria-hidden>
                <Icon size={20} />
                {badge > 0 ? <span className="client-bottom-nav-dot">{badge > 9 ? '9+' : badge}</span> : null}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`client-bottom-nav-item${moreOpen ? ' is-active' : ''}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="client-bottom-nav-icon" aria-hidden>
            <MoreHorizontal size={20} />
          </span>
          <span>Ещё</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className="client-bottom-more" role="menu">
          <Link to="/dashboard/client/vehicles" role="menuitem" onClick={() => setMoreOpen(false)}>
            Мои автомобили
          </Link>
          <Link to="/dashboard/client/profile" role="menuitem" onClick={() => setMoreOpen(false)}>
            Профиль
          </Link>
          <Link to="/consult" role="menuitem" onClick={() => setMoreOpen(false)}>
            ИИ-диагностика
          </Link>
          <Link to="/services" role="menuitem" onClick={() => setMoreOpen(false)}>
            Каталог услуг
          </Link>
          <Link to="/" role="menuitem" onClick={() => setMoreOpen(false)}>
            На сайт
          </Link>
          <button
            type="button"
            role="menuitem"
            className="client-bottom-more-logout"
            onClick={() => {
              setMoreOpen(false);
              void logout();
              navigate('/login');
            }}
          >
            Выйти
          </button>
        </div>
      ) : null}
    </>
  );
}
