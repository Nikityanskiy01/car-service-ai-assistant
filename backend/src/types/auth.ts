export type AuthUser = {
  id: string;
  role: string;
  email: string;
  totpSetupPending?: boolean;
};

export type ConsultationActor =
  | { kind: 'staff'; user: AuthUser }
  | { kind: 'owner'; user: AuthUser }
  | { kind: 'guest'; user?: undefined };
