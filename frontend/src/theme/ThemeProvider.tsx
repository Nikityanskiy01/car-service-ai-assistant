/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ThemeContextValue, ThemeMode } from './theme.types';
import { useProductConfig } from '../config/ProductConfigProvider';

const THEME_KEY = 'car_service_theme_mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function detectPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const cached = localStorage.getItem(THEME_KEY);
  if (cached === 'light' || cached === 'dark') return cached;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

function updateThemeColorMeta(mode: ThemeMode, primary: string) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute('content', mode === 'light' ? '#f4f4f5' : primary);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const productConfig = useProductConfig();
  const [mode, setMode] = useState<ThemeMode>(() => detectPreferredTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    root.style.setProperty('--brand-primary', productConfig.theme.primary);
    root.style.setProperty('--brand-secondary', productConfig.theme.secondary);
    root.style.setProperty('--brand-accent', productConfig.theme.accent);
    localStorage.setItem(THEME_KEY, mode);
    updateThemeColorMeta(mode, productConfig.theme.primary);
  }, [mode, productConfig.theme.primary, productConfig.theme.secondary, productConfig.theme.accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
