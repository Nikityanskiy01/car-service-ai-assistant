/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../api/errors';
import { api, clearLocalAuthState, getCachedUser, getCsrfToken, setCachedUser } from '../api/client';
import type { AuthContextValue } from './auth.types';
import type { AuthUser, UserRole } from '../types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

/** CSRF cookie is set together with auth cookies — absence means no session to refresh. */
function likelyHasSession(): boolean {
  return Boolean(getCachedUser() || getCsrfToken());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => getCachedUser());
  const [isLoading, setIsLoading] = useState(() => likelyHasSession());

  const setUser = useCallback((nextUser: AuthUser | null) => {
    setUserState(nextUser);
    setCachedUser(nextUser);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!likelyHasSession()) {
      setUser(null);
      return;
    }
    try {
      const me = await api<AuthUser>('/users/me');
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setUser(null);
      }
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
    if (!likelyHasSession()) {
      setIsLoading(false);
      return;
    }
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
