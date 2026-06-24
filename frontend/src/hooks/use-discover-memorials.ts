"use client";

import useSWR from "swr";

import { api } from "@/lib/api-client";
import { resolveDiscoveryMemorials } from "@/lib/memorial-adapters";
import type { ExploreFeedKind } from "@/types/memorial";

export function useDiscoverMemorials(kind: ExploreFeedKind, locale: string, limit = 12) {
  const swr = useSWR(
    ["discover-memorials", kind, locale, limit],
    () => api.discoverMemorials({ kind, locale, limit }),
    { revalidateOnFocus: false },
  );

  return {
    ...swr,
    memorials: resolveDiscoveryMemorials(swr.data, locale),
  };
}
