import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { CalendarDays, Menu, Wrench, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { ThemeToggle } from './ThemeToggle';
import { useI18n } from '../../i18n/I18nProvider';

export function Header() {
  const productConfig = useProductConfig();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const publicLinks = [
    { to: '/', label: t('navHome') },
    { to: '/services', label: t('navServices') },
    { to: '/consult', label: t('navConsult') },
    { to: '/works', label: t('navWorks') },
    { to: '/gallery', label: t('navGallery') },
    { to: '/about', label: t('navAbout') },
  ];

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

        <nav className="fm-nav" aria-label={t('navMain')}>
          {publicLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="fm-header-actions">
          <div className="fm-header-cta-group">
            <Link to="/booking" className="fm-btn fm-btn-outline fm-header-book" aria-label={t('bookAria')}>
              <CalendarDays size={16} aria-hidden="true" className="fm-header-book-icon" />
              <span className="fm-header-book-text">{t('bookCta')}</span>
            </Link>
            <Link to="/consult" className="fm-btn fm-btn-primary fm-header-cta">
              {t('consultCta')}
            </Link>
            {user ? (
              <div className="fm-header-auth">
                <Link to={dashboardPath} className="fm-btn fm-btn-ghost">
                  {t('cabinet')}
                </Link>
                <button type="button" className="fm-btn fm-btn-ghost" onClick={() => void logout()}>
                  {t('logout')}
                </button>
              </div>
            ) : (
              <Link to="/login" className="fm-btn fm-btn-ghost fm-header-auth">
                {t('login')}
              </Link>
            )}
          </div>
          <div className="fm-header-tools">
            <div className="fm-header-lang" role="group" aria-label={t('langSwitcher')}>
              <button
                type="button"
                className={`fm-btn fm-btn-ghost${locale === 'ru' ? ' is-active' : ''}`}
                aria-pressed={locale === 'ru'}
                onClick={() => setLocale('ru')}
              >
                {t('langRu')}
              </button>
              <button
                type="button"
                className={`fm-btn fm-btn-ghost${locale === 'en' ? ' is-active' : ''}`}
                aria-pressed={locale === 'en'}
                onClick={() => setLocale('en')}
              >
                {t('langEn')}
              </button>
            </div>
            <ThemeToggle />
            <button
              type="button"
              className="fm-menu-btn"
              aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="fm-mobile-nav" aria-label={t('navMobile')}>
          {publicLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={() => setMobileOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <Link to="/booking" onClick={() => setMobileOpen(false)}>
            {t('bookService')}
          </Link>
          <div className="fm-mobile-nav-divider" role="separator" aria-hidden="true" />
          {user ? (
            <>
              <Link to={dashboardPath} onClick={() => setMobileOpen(false)}>
                {t('personalCabinet')}
              </Link>
              <button
                type="button"
                className="fm-mobile-nav-logout"
                onClick={() => {
                  setMobileOpen(false);
                  void logout();
                }}
              >
                {t('logout')}
              </button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              {t('login')}
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}
