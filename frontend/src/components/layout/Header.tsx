import { CarFront, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useAppRuntime } from '../../app/providers/AppRuntimeProvider';
import { productConfig } from '../../config/productConfig';
import { Button } from '../ui/Button';
import { DemoModeBanner } from '../product/DemoModeBanner';
import { MobileNavigation } from './MobileNavigation';
import { ThemeToggle } from './ThemeToggle';

const publicLinks = [
  { to: '/', label: 'Главная' },
  { to: '/services', label: 'Услуги' },
  { to: '/works', label: 'Работы' },
  { to: '/gallery', label: 'Галерея' },
  { to: '/about', label: 'О системе' },
  { to: '/consult', label: 'Консультация' },
  { to: '/booking', label: 'Запись' },
];

export function Header() {
  const { user, logout } = useAuth();
  const { demoMode } = useAppRuntime();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardPath =
    user?.role === 'ADMINISTRATOR'
      ? '/dashboard/admin'
      : user?.role === 'MANAGER'
        ? '/dashboard/manager'
        : '/dashboard/client';

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label={productConfig.productName}>
          <CarFront size={20} />
          <span>{productConfig.productName}</span>
        </Link>
        <nav className="nav-desktop" aria-label="Основная навигация">
          {publicLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link to={dashboardPath}>Кабинет</Link>
              <Button variant="ghost" onClick={() => void logout()}>
                Выйти
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">Вход</Link>
              <Link to="/register">Регистрация</Link>
            </>
          )}
          <ThemeToggle />
          <button type="button" className="mobile-toggle" onClick={() => setMobileOpen((x) => !x)}>
            <Menu size={18} />
          </button>
        </div>
      </div>
      <DemoModeBanner enabled={demoMode} />
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} links={publicLinks} />
    </header>
  );
}
