import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { CalendarDays, Menu, Wrench, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { ThemeToggle } from './ThemeToggle';

const publicLinks = [
  { to: '/', label: 'Главная' },
  { to: '/services', label: 'Услуги' },
  { to: '/consult', label: 'ИИ-диагностика' },
  { to: '/works', label: 'Работы' },
  { to: '/gallery', label: 'Галерея' },
  { to: '/about', label: 'О сервисе и контакты' },
];

export function Header() {
  const productConfig = useProductConfig();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardPath =
    user?.role === 'ADMINISTRATOR'
      ? '/dashboard/admin'
      : user?.role === 'MANAGER'
        ? '/dashboard/manager'
        : '/dashboard/client';

  return (
    <header className="fm-header">
      <div className="fm-header-inner">
        <Link to="/" className="fm-logo" aria-label={productConfig.productName}>
          <span className="fm-logo-icon" aria-hidden="true">
            <Wrench size={18} />
          </span>
          <span className="fm-logo-text">{productConfig.shortName}</span>
        </Link>

        <nav className="fm-nav" aria-label="Основная навигация">
          {publicLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="fm-header-actions">
          <Link to="/booking" className="fm-btn fm-btn-outline fm-header-book" aria-label="Записаться в сервис">
            <CalendarDays size={16} aria-hidden="true" className="fm-header-book-icon" />
            <span className="fm-header-book-text">Записаться</span>
          </Link>
          <Link to="/consult" className="fm-btn fm-btn-primary fm-header-cta">
            ИИ-диагностика
          </Link>
          {user ? (
            <>
              <Link to={dashboardPath} className="fm-btn fm-btn-ghost">
                Кабинет
              </Link>
              <button type="button" className="fm-btn fm-btn-ghost" onClick={() => void logout()}>
                Выйти
              </button>
            </>
          ) : (
            <Link to="/login" className="fm-btn fm-btn-ghost">
              Вход
            </Link>
          )}
          <ThemeToggle />
          <button
            type="button"
            className="fm-menu-btn"
            aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="fm-mobile-nav" aria-label="Мобильная навигация">
          {publicLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={() => setMobileOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <Link to="/booking" onClick={() => setMobileOpen(false)}>
            Записаться в сервис
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
