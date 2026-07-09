/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearLocalAuthState, getCachedUser, setCachedUser } from '../api/client';
import type { AuthContextValue } from './auth.types';
import type { AuthUser, UserRole } from '../types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    setUserState(nextUser);
    setCachedUser(nextUser);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const me = await api<AuthUser>('/users/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clearLocalAuthState();
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    void (async () => {
      await refreshCurrentUser();
      setIsLoading(false);
    })();
  }, [refreshCurrentUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      hasRole: (roles: UserRole[]) => !!user && roles.includes(user.role),
      refreshCurrentUser,
      logout,
      setUser,
    }),
    [isLoading, logout, refreshCurrentUser, setUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
