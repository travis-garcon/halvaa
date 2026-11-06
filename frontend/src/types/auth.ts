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
  phone_number: string | null;
  address: string | null;
  profile_completed: boolean;
  locked_email: boolean;
  locked_phone_number: boolean;
  profile_completion_percent: number;
  missing_profile_fields: string[];
  entitlements: {
    memorial_limit: number;
    memorials_used: number;
    memorials_remaining: number;
    custom_id_limit: number;
    custom_ids_used: number;
    custom_ids_remaining: number;
  };
  is_superuser: boolean;
  role: "USER" | "ADMIN" | string;
};

export type UserUpdatePayload = {
  full_name?: string;
  locale?: string;
  avatar_url?: string | null;
  email?: string;
  phone_number?: string | null;
  address?: string | null;
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
  debug_code?: string | null;
};
