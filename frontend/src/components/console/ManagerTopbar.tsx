import { Link } from 'react-router-dom';
import { CircleHelp, Home, LogOut, Menu, Search, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { ThemeToggle } from '../layout/ThemeToggle';
import { InboxBell } from '../notifications/InboxBell';
import { HintTooltip } from '../manager/help/HintLabel';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function ManagerTopbar({
  title,
  roleLabel,
  profilePath,
  onMenuClick,
  onCommandPalette,
  onHelp,
  totpLock = false,
}: {
  title: string;
  roleLabel?: string;
  profilePath: string;
  onMenuClick: () => void;
  onCommandPalette?: () => void;
  onHelp?: () => void;
  totpLock?: boolean;
}) {
  const { user, logout } = useAuth();
  const name = user?.fullName || user?.email || 'Менеджер';

  return (
    <header className="dashboard-topbar">
      <div className="flex min-w-0 items-center gap-3">
        {totpLock ? null : (
          <button type="button" className="dashboard-topbar-menu" onClick={onMenuClick} aria-label="Открыть меню">
            <Menu size={18} />
          </button>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="dashboard-topbar-title truncate">{title}</h2>
          {roleLabel ? <span className="dashboard-role-chip">{roleLabel}</span> : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onCommandPalette ? (
          <HintTooltip hint="Поиск разделов и фильтров очереди">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCommandPalette}
              aria-label="Командная палитра"
              className="hidden text-muted-foreground md:inline-flex"
            >
              <Search />
              Поиск
              <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] font-medium">Ctrl+K</kbd>
            </Button>
          </HintTooltip>
        ) : null}
        {onHelp ? (
          <HintTooltip hint="Как устроена смена и этот экран">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onHelp}
              aria-label="Справка кабинета"
            >
              <CircleHelp />
            </Button>
          </HintTooltip>
        ) : null}
        <ThemeToggle />
        {totpLock ? null : <InboxBell />}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Меню пользователя" className="rounded-lg">
                <Avatar className="size-8">
                  <AvatarImage src={user.avatarUrl || undefined} alt="" />
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={profilePath}>
                  <User />
                  Профиль
                </Link>
              </DropdownMenuItem>
              {onHelp ? (
                <DropdownMenuItem onSelect={onHelp}>
                  <CircleHelp />
                  Справка
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link to="/">
                  <Home />
                  На сайт
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void logout()}>
                <LogOut />
                Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
