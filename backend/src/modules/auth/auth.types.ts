import type { PreferredContact, Role, User } from '@prisma/client';

export type AuthUserRow = User;

export type SessionMeta = {
  ip?: string | null;
  userAgent?: string | null;
  familyId?: string;
  totpSetupPending?: boolean;
};

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  emailProfile: string | null;
  avatarUrl: string | null;
  city: string | null;
  telegram: string | null;
  preferredContact: PreferredContact | null;
  createdAt: string | Date;
  totpEnabled: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  telegramLinked: boolean;
};

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
  totpSetupPending: boolean;
};

export type LoginCredentials = {
  identifier?: string;
  email?: string;
  password: string;
};

export type TotpLoginInput = {
  challengeToken: string;
  code: string;
};

export type TotpChallenge = {
  requires2fa: true;
  challengeToken: string;
};

export type LoginResult = IssuedSession | TotpChallenge;

export function isTotpChallenge(out: LoginResult): out is TotpChallenge {
  return 'requires2fa' in out && out.requires2fa === true;
}

export type OtpChannel = 'email' | 'sms' | 'telegram';

export type StartLoginOtpInput = {
  channel: OtpChannel;
  email?: string;
  phone?: string;
};

export type VerifyLoginOtpInput = {
  challengeToken: string;
  code: string;
};

export type OtpStartPayload = {
  challengeToken: string;
  channel: OtpChannel;
  destinationHint: string;
  expiresInSec: number;
  resendAfterSec: number;
};

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

export type EmailCodeInput = {
  email: string;
  code: string;
};

export type PasswordResetInput = {
  token: string;
  password: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type LoginEventInput = {
  userId: string;
  success: boolean;
  method?: string;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string | null;
};
