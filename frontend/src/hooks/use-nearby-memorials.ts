"use client";

import useSWR from "swr";
import { useEffect } from "react";

import { api } from "@/lib/api-client";
import { subscribeToMemorialDeletes } from "@/lib/explore-cache";
import { resolveGridMemorials } from "@/lib/memorial-adapters";
import { useGeolocation } from "@/hooks/use-geolocation";

export function useNearbyMemorials(locale: string, query = "", radiusM = 5000, limit = 30) {
  const { coordinates, status: geoStatus } = useGeolocation();

  const swr = useSWR(
    geoStatus === "pending"
      ? null
      : ["nearby-memorials", coordinates.latitude, coordinates.longitude, locale, query, radiusM, limit],
    () =>
      api.nearbyMemorials({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        radiusM,
        locale,
        q: query,
        limit,
      }),
    {
      revalidateOnMount: true,
      keepPreviousData: true,
    },
  );
  const { mutate } = swr;
  useEffect(() => subscribeToMemorialDeletes(() => {
    void mutate(undefined, { revalidate: true });
  }), [mutate]);

  const memorials = resolveGridMemorials(swr.data, locale);

  return {
    ...swr,
    memorials,
    collection: swr.data,
    coordinates,
    geoStatus,
    isLoading: geoStatus === "pending" || swr.isLoading,
  };
}
