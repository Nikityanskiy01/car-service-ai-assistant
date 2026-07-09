export type UserRole = 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  blockedAt?: string | null;
  emailProfile?: string | null;
}
