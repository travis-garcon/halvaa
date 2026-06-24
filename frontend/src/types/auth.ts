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
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  locale?: string;
};
