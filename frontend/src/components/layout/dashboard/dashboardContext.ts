import { createContext, useContext } from 'react';

export type DashboardContextValue = {
  setPageTitle: (title: string) => void;
  setBadges: (badges: Record<string, number>) => void;
  openManagerHelp: () => void;
};

const noopChrome: DashboardContextValue = {
  setPageTitle: () => {},
  setBadges: () => {},
  openManagerHelp: () => {},
};

/**
 * Живой регистр на случай, если React-контекст «потерялся»:
 * ленивый чанк страницы и шелл кабинета могут получить разные копии
 * `createContext`, а вложенный `<Outlet />` без `context` обнуляет
 * outlet-context. Модульные колбэки всегда определены — страница
 * не падает на `const { setBadges } = useDashboardContext()`.
 */
let chrome: DashboardContextValue = noopChrome;

export function bindDashboardChrome(next: DashboardContextValue) {
  chrome = next;
  return () => {
    if (chrome === next) chrome = noopChrome;
  };
}

export const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function useDashboardContext(): DashboardContextValue {
  return useContext(DashboardContext) ?? chrome;
}
