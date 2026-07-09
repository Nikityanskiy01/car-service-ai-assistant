/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

export interface DemoAccountOption {
  role: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';
  label: string;
}

interface AppRuntimeContextValue {
  demoMode: boolean;
  demoAccounts: DemoAccountOption[];
  loading: boolean;
}

const AppRuntimeContext = createContext<AppRuntimeContextValue>({
  demoMode: false,
  demoAccounts: [],
  loading: true,
});

export function AppRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountOption[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const payload = await api<{ enabled: boolean; accounts: DemoAccountOption[] }>('/auth/demo-accounts', {
          skipAuthRefresh: true,
        });
        setDemoMode(!!payload.enabled);
        setDemoAccounts(payload.accounts || []);
      } catch {
        setDemoMode(false);
        setDemoAccounts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      demoMode,
      demoAccounts,
      loading,
    }),
    [demoAccounts, demoMode, loading],
  );

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime() {
  return useContext(AppRuntimeContext);
}
