"use client";

import useSWR from "swr";

import { api } from "@/lib/api-client";

export function useMemorial(slug: string) {
  return useSWR(
    slug ? ["memorial", slug] : null,
    () => api.memorialBySlug(slug, true),
    { revalidateOnFocus: false },
  );
}
