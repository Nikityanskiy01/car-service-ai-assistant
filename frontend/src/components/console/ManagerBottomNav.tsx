import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Search,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { cn } from '../../lib/utils';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';

type NavBadges = Record<string, number>;

const MAIN_TABS = [
  { id: 'desk', label: 'Стол', to: '/dashboard/manager', icon: LayoutDashboard, end: true },
  { id: 'requests', label: 'Очередь', to: '/dashboard/manager/requests', icon: ClipboardList },
  { id: 'calendar', label: 'Календарь', to: '/dashboard/manager/calendar', icon: CalendarDays },
  { id: 'clients', label: 'Клиенты', to: '/dashboard/manager/clients', icon: Users },
] as const;

const MORE_LINKS = [
  { id: 'contacts', label: 'Входящие', to: '/dashboard/manager/contacts', icon: Bell },
  { id: 'ai-quality', label: 'Качество ИИ', to: '/dashboard/manager/ai-quality', icon: BrainCircuit },
  { id: 'manager-profile', label: 'Профиль', to: '/dashboard/manager/profile', icon: User },
] as const;

function formatBadge(value?: number) {
  if (!value) return null;
  return value > 99 ? '99+' : String(value);
}

export function ManagerBottomNav({
  badges = {},
  onCommandPalette,
}: {
  badges?: NavBadges;
  onCommandPalette?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreRouteActive = MORE_LINKS.some((item) => location.pathname.startsWith(item.to));
  const moreBadgeCount = (badges.contacts || 0) + (badges['ai-quality'] || 0);
  const moreBadge = formatBadge(moreBadgeCount);

  return (
    <>
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden max-[920px]:flex"
        aria-label="Основные разделы"
      >
        <div
          data-manager-tabbar=""
          className="pointer-events-auto flex w-full border-t border-border bg-card/95 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-card/88"
          style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
        >
          {MAIN_TABS.map((item) => {
            const Icon = item.icon;
            const badge = formatBadge(badges[item.id]);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={'end' in item ? item.end : false}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-none text-muted-foreground no-underline transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]',
                    isActive && 'font-semibold text-primary',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" aria-hidden />
                    ) : null}
                    <span className="relative inline-flex">
                      <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                      {badge ? (
                        <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">
                          {badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="max-w-full truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
          <button
            type="button"
            className={cn(
              'relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent px-1 text-[11px] leading-none text-muted-foreground transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]',
              (moreOpen || moreRouteActive) && 'font-semibold text-primary',
            )}
            aria-expanded={moreOpen}
            aria-controls="manager-more-sheet"
            onClick={() => setMoreOpen(true)}
          >
            {moreOpen || moreRouteActive ? (
              <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" aria-hidden />
            ) : null}
            <span className="relative inline-flex">
              <MoreHorizontal size={20} strokeWidth={moreOpen || moreRouteActive ? 2.25 : 1.75} aria-hidden />
              {moreBadge ? (
                <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums">
                  {moreBadge}
                </span>
              ) : null}
            </span>
            <span>Ещё</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          id="manager-more-sheet"
          side="bottom"
          className="gap-2 rounded-t-xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border" aria-hidden />
          <SheetHeader className="p-0 pb-1">
            <SheetTitle>Ещё</SheetTitle>
            <SheetDescription className="sr-only">Входящие, качество ИИ, профиль и выход</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-0.5">
            {MORE_LINKS.map((item) => {
              const Icon = item.icon;
              const badge = formatBadge(badges[item.id]);
              const active = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground no-underline transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent active:scale-[0.98]',
                    active && 'bg-primary/10 font-medium',
                  )}
                >
                  <Icon size={18} className={cn('shrink-0 text-muted-foreground', active && 'text-primary')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {badge ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                      {badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
            {onCommandPalette ? (
              <button
                type="button"
                className="flex min-h-11 items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left text-sm text-foreground transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent active:scale-[0.98]"
                onClick={() => {
                  setMoreOpen(false);
                  onCommandPalette();
                }}
              >
                <Search size={18} className="shrink-0 text-muted-foreground" aria-hidden />
                Поиск
              </button>
            ) : null}
            <Link
              to="/"
              onClick={() => setMoreOpen(false)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground no-underline transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent active:scale-[0.98]"
            >
              <Home size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              На сайт
            </Link>
            <Button
              type="button"
              variant="ghost"
              className="h-11 justify-start px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setMoreOpen(false);
                void logout().then(() => navigate('/login'));
              }}
            >
              <LogOut />
              Выйти
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
