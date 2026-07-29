/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';

interface AppRuntimeContextValue {
  loading: boolean;
}

const AppRuntimeContext = createContext<AppRuntimeContextValue>({
  loading: false,
});

/** Runtime shell — demo mode removed for production. */
export function AppRuntimeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ loading: false }), []);
  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime() {
  return useContext(AppRuntimeContext);
}
