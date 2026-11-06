"use client";

import useSWRInfinite from "swr/infinite";
import { useCallback, useEffect, useMemo } from "react";

import { api } from "@/lib/api-client";
import { subscribeToMemorialDeletes } from "@/lib/explore-cache";
import { resolveDiscoveryMemorials } from "@/lib/memorial-adapters";
import type { ExploreFeedKind } from "@/types/memorial";

export function useDiscoverMemorials(kind: ExploreFeedKind, locale: string, query = "", pageSize = 30) {
  const swr = useSWRInfinite(
    (pageIndex, previousPage) => {
      if (previousPage && !previousPage.has_more) return null;
      return ["discover-memorials", kind, locale, query, pageIndex, pageSize] as const;
    },
    ([, requestKind, requestLocale, requestQuery, pageIndex, requestPageSize]) =>
      api.discoverMemorials({
        kind: requestKind,
        locale: requestLocale,
        limit: requestPageSize,
        offset: pageIndex * requestPageSize,
        q: requestQuery,
      }),
    { revalidateOnFocus: true, revalidateOnReconnect: true },
  );
  const { mutate } = swr;
  useEffect(() => subscribeToMemorialDeletes(() => {
    void mutate(undefined, { revalidate: true });
  }), [mutate]);
  const mergedData = useMemo(() => {
    if (!swr.data?.length) return undefined;
    return {
      ...swr.data[swr.data.length - 1],
      items: swr.data.flatMap((page) => page.items),
    };
  }, [swr.data]);
  const memorials = useMemo(() => resolveDiscoveryMemorials(mergedData, locale), [locale, mergedData]);
  const lastPage = swr.data?.[swr.data.length - 1];
  const { setSize } = swr;
  const loadMore = useCallback(() => setSize((current) => current + 1), [setSize]);
  const resetPages = useCallback(() => setSize(1), [setSize]);

  return {
    ...swr,
    memorials,
    hasMore: Boolean(lastPage?.has_more),
    total: lastPage?.total ?? memorials.length,
    loadMore,
    resetPages,
  };
}
