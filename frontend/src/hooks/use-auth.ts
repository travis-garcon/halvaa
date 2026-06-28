"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";

import { api, buildApiUrl } from "@/lib/api-client";
import {
  setAccessToken,
} from "@/lib/auth-storage";
import type { OtpStartPayload, RegisterPayload, UserPublic } from "@/types/auth";

const AUTH_ME_KEY = ["auth", "me"] as const;

export function getZitadelLoginUrl(): string {
  return buildApiUrl("/auth/signin");
}

export function getZitadelLogoutUrl(): string {
  return buildApiUrl("/auth/logout");
}

export function getGoogleLoginUrl(): string {
  return buildApiUrl("/auth/google/signin");
}

export function useAuth() {
  const { data: user, error, isLoading, mutate } = useSWR<UserPublic>(
    AUTH_ME_KEY,
    () => api.me(),
    {
      revalidateOnFocus: false,
      errorRetryCount: 0,
      shouldRetryOnError: false,
    },
  );

  const zitadelLogin = useCallback(() => {
    window.location.href = getZitadelLoginUrl();
  }, []);

  const googleLogin = useCallback(() => {
    window.location.href = getGoogleLoginUrl();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const token = await api.login(email, password);
      setAccessToken(token.access_token);
      const me = await api.me();
      await globalMutate(AUTH_ME_KEY, me);
    },
    [],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const token = await api.register(payload);
      setAccessToken(token.access_token);
      await globalMutate(AUTH_ME_KEY, api.me());
    },
    [],
  );

  const startOtp = useCallback((payload: OtpStartPayload) => api.startOtp(payload), []);

  const verifyOtp = useCallback(async (otpId: string, code: string) => {
    const token = await api.verifyOtp(otpId, code);
    setAccessToken(token.access_token);
    await globalMutate(AUTH_ME_KEY, api.me());
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    void mutate(undefined, { revalidate: false });
    window.location.href = "/";
  }, [mutate]);

  return {
    user,
    error,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    startOtp,
    verifyOtp,
    logout,
    zitadelLogin,
    googleLogin,
  };
}
