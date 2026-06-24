"use client";

import { useEffect, useState } from "react";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_COORDINATES: Coordinates = {
  latitude: 35.6892,
  longitude: 51.389,
};

type GeolocationStatus = "pending" | "ready" | "error";

export function useGeolocation() {
  const [coordinates, setCoordinates] = useState<Coordinates>(DEFAULT_COORDINATES);
  const [status, setStatus] = useState<GeolocationStatus>(() =>
    typeof navigator !== "undefined" && !navigator.geolocation ? "error" : "pending",
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatus("ready");
      },
      () => {
        setStatus("error");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 120_000,
      },
    );
  }, []);

  return { coordinates, status };
}
