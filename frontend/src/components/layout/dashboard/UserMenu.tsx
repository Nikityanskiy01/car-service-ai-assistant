import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Home, LogOut, User } from 'lucide-react';
import { useAuth } from '../../../auth/AuthProvider';
import { UserAvatar } from '../../ui/UserAvatar';

export function UserMenu({ profilePath }: { profilePath: string }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!user) return null;

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={user.fullName || user.email} avatarUrl={user.avatarUrl} />
        <div className="dashboard-profile-meta">
          <strong>{user.fullName || 'Пользователь'}</strong>
          <small>{user.email}</small>
        </div>
        <ChevronDown size={16} className={`user-menu-chevron${open ? ' open' : ''}`} aria-hidden />
      </button>

      {open ? (
        <div className="user-menu-panel" role="menu">
          <Link to={profilePath} className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <User size={16} aria-hidden />
            Профиль
          </Link>
          <Link to="/" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
            <Home size={16} aria-hidden />
            На сайт
          </Link>
          <button
            type="button"
            className="user-menu-item is-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOut size={16} aria-hidden />
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}
