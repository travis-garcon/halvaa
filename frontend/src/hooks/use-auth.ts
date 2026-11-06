"use client";

import { useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";

import { notifyApp } from "@/components/ui/AppNotifications";
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
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL ?? buildApiUrl("/auth/google/signin");
}

export function useAuth() {
  const t = useTranslations("auth");
  const { data: user, error, isLoading, mutate } = useSWR<UserPublic>(
    AUTH_ME_KEY,
    () => api.me(),
    {
      revalidateOnFocus: false,
      errorRetryCount: 0,
      shouldRetryOnError: false,
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("access_token");
    const authError = url.searchParams.get("auth_error");
    if (authError) {
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", url.toString());
      notifyApp({
        message: t("error_generic"),
        tone: "error",
      });
    }
    if (!token) return;
    setAccessToken(token);
    url.searchParams.delete("access_token");
    url.searchParams.delete("auth_provider");
    window.history.replaceState({}, "", url.toString());
    void globalMutate(AUTH_ME_KEY, api.me());
  }, [t]);

  const zitadelLogin = useCallback(() => {
    window.location.href = getZitadelLoginUrl();
  }, []);

  const googleLogin = useCallback(() => {
    const url = getGoogleLoginUrl();
    if (url) {
      window.location.href = url;
    }
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
