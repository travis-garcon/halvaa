"use client";

import useSWR from "swr";

import { api } from "@/lib/api-client";
import { resolveGridMemorials } from "@/lib/memorial-adapters";
import { useGeolocation } from "@/hooks/use-geolocation";

export function useNearbyMemorials(locale: string, radiusM = 5000) {
  const { coordinates, status: geoStatus } = useGeolocation();

  const swr = useSWR(
    geoStatus === "pending"
      ? null
      : ["nearby-memorials", coordinates.latitude, coordinates.longitude, locale, radiusM],
    () =>
      api.nearbyMemorials({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        radiusM,
        locale,
      }),
    {
      revalidateOnMount: true,
      keepPreviousData: true,
    },
  );

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
