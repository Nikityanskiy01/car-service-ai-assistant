import type { AuthUser, UserRole } from '../types/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  refreshCurrentUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}
