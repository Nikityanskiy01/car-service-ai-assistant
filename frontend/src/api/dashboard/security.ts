import { api } from '../client';

export type LoginHistoryItem = {
  id: string;
  success: boolean;
  method: string;
  methodLabel?: string;
  ip: string | null;
  ipLabel?: string | null;
  ipKind?: string | null;
  userAgent: string | null;
  device?: import('../../lib/clientMeta').ClientDeviceMeta;
  reason: string | null;
  reasonLabel?: string | null;
  createdAt: string;
};

export type ActiveSessionItem = {
  id: string;
  current: boolean;
  device?: import('../../lib/clientMeta').ClientDeviceMeta;
  ip: string | null;
  ipLabel?: string | null;
  ipKind?: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
};

export type SecurityOverview = {
  totpEnabled: boolean;
  totpEnabledAt: string | null;
  backupRemaining: number;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  telegram: string | null;
  telegramLinked: boolean;
  telegramLinkedAt: string | null;
  telegramBotUsername: string | null;
  loginMethods: {
    password: boolean;
    emailOtp: boolean;
    sms: boolean;
    telegram: boolean;
  };
  channels: {
    emailConfigured: boolean;
    smsConfigured: boolean;
    telegramConfigured: boolean;
  };
  history: LoginHistoryItem[];
  sessions: ActiveSessionItem[];
};

export type TotpSetupPayload = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  issuer: string;
  account: string;
  backupCodes: string[];
};

export function getSecurityOverview() {
  return api<SecurityOverview>('/users/me/security');
}

export function exportMyData() {
  return api<Record<string, unknown>>('/users/me/privacy/export');
}

export function deleteMyAccount(body: { password: string; code?: string }) {
  return api<{ ok: true }>('/users/me/privacy/delete', { method: 'POST', body });
}

export function startTotpSetup() {
  return api<TotpSetupPayload>('/users/me/2fa/setup', { method: 'POST', body: {} });
}

export function confirmTotpSetup(code: string) {
  return api<{ ok: true; backupCodes: string[]; totpSetupPending?: boolean; user?: import('../../types/auth').AuthUser }>(
    '/users/me/2fa/confirm',
    {
      method: 'POST',
      body: { code },
    },
  );
}

export function abortTotpSetup() {
  return api<{ ok: true }>('/users/me/2fa/setup/cancel', { method: 'POST', body: {} });
}

export function regenerateBackupCodes(body: { password: string; code: string }) {
  return api<{ ok: true; backupCodes: string[] }>('/users/me/2fa/backup-codes', {
    method: 'POST',
    body,
  });
}

export function disableTotp(body: { password: string; code: string; confirmPhrase: string }) {
  return api<{ ok: true }>('/users/me/2fa/disable', { method: 'POST', body });
}

export type SessionRevokeScope = 'one' | 'others';

export type SessionRevokeChallenge = {
  scope: SessionRevokeScope;
  targetLabel: string;
  destinationHint: string;
  expiresInSec: number;
  resendAfterSec: number;
};

export function startSessionRevoke(body: { scope: SessionRevokeScope; sessionId?: string }) {
  return api<SessionRevokeChallenge>('/users/me/sessions/revoke/start', {
    method: 'POST',
    body,
  });
}

export function revokeSession(sessionId: string, code: string) {
  return api<{ ok: true; currentRevoked?: boolean }>(`/users/me/sessions/${sessionId}`, {
    method: 'DELETE',
    body: { code },
  });
}

export function revokeOtherSessions(code: string) {
  return api<{ ok: true; revoked: number }>('/users/me/sessions/revoke-others', {
    method: 'POST',
    body: { code },
  });
}

export type PhoneVerifyStart = {
  alreadyVerified?: boolean;
  challengeToken?: string;
  destinationHint?: string;
  expiresInSec?: number;
  resendAfterSec?: number;
};

export type TelegramLinkStart = {
  alreadyLinked?: boolean;
  code?: string;
  botUsername?: string | null;
  deepLink?: string | null;
  expiresInSec?: number;
  resendAfterSec?: number;
};

export function startPhoneVerification() {
  return api<PhoneVerifyStart>('/users/me/phone/verify/start', { method: 'POST', body: {} });
}

export function confirmPhoneVerification(code: string) {
  return api<{ ok: true; phoneVerified: boolean }>('/users/me/phone/verify/confirm', {
    method: 'POST',
    body: { code },
  });
}

export function startTelegramLink() {
  return api<TelegramLinkStart>('/users/me/telegram/link/start', { method: 'POST', body: {} });
}

export type SensitiveActionVerification = {
  password: string;
  code?: string;
};

export function unlinkTelegram(body: SensitiveActionVerification) {
  return api<{ ok: true }>('/users/me/telegram/unlink', { method: 'POST', body });
}

export function updateLoginMethods(body: {
  loginEmailOtpEnabled?: boolean;
  loginSmsEnabled?: boolean;
  loginTelegramEnabled?: boolean;
  password?: string;
  code?: string;
}) {
  return api<{ ok: true }>('/users/me/login-methods', { method: 'POST', body });
}
