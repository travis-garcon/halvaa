export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserPublic = {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  avatar_url: string | null;
  is_superuser: boolean;
  role: "USER" | "ADMIN" | string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  locale?: string;
};

export type OtpStartPayload = {
  identifier: string;
  email?: string | null;
  full_name?: string | null;
  locale?: string;
  phone_number?: string | null;
};

export type OtpStartResponse = {
  otp_id: string;
  delivery_provider: string;
  expires_in_seconds: number;
  is_new_user: boolean;
};
