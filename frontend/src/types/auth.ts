export type UserRole = 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';

export type PreferredContact = 'PHONE' | 'EMAIL' | 'TELEGRAM';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  blockedAt?: string | null;
  emailProfile?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  telegram?: string | null;
  preferredContact?: PreferredContact | null;
  createdAt?: string | null;
}
