import { api } from '../client';

export type UserProfile = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role: string;
  emailProfile?: string | null;
  avatarUrl?: string | null;
  city?: string | null;
  telegram?: string | null;
  preferredContact?: import('../../types/auth').PreferredContact | null;
  createdAt?: string | null;
};

export function getProfile() {
  return api<UserProfile>('/users/me');
}

export function getClientDashboardSummary() {
  return api<import('../../features/client-cases/resolveClientHero').ClientDashboardSummary>(
    '/users/me/summary',
  );
}

export function patchProfile(body: {
  fullName?: string;
  phone?: string;
  emailProfile?: string | null;
  city?: string | null;
  telegram?: string | null;
  preferredContact?: import('../../types/auth').PreferredContact | null;
}) {
  return api<UserProfile>('/users/me', { method: 'PATCH', body });
}

export function uploadAvatar(body: { mimeType: string; contentBase64: string }) {
  return api<UserProfile>('/users/me/avatar', { method: 'POST', body });
}

export function removeAvatar() {
  return api<UserProfile>('/users/me/avatar', { method: 'DELETE' });
}

export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return api<{ ok: true; user?: import('../../types/auth').AuthUser }>('/users/me/password', {
    method: 'POST',
    body,
  });
}
