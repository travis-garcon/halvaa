"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { DEFAULT_COORDINATES } from "@/hooks/use-geolocation";
import { MAPBOX_ACCESS_TOKEN, getMapStyleUrl } from "@/lib/map-config";

export type PickedLocation = {
  latitude: number;
  longitude: number;
};

type MapboxLocationPickerProps = {
  open: boolean;
  locale: string;
  title?: string;
  value?: PickedLocation | null;
  onPick: (location: PickedLocation) => void;
  onClose: () => void;
};

let rtlTextPluginRegistered = false;

function localizedMapboxStyle(locale: string): string | null {
  const style = getMapStyleUrl();
  if (!style) return null;
  if (!style.includes("api.mapbox.com/styles/v1/mapbox/")) return style;
  const language = locale === "fa" ? "fa" : locale === "ar" ? "ar" : locale === "zh" ? "zh-Hans" : "en";
  const url = new URL(style);
  url.searchParams.set("language", language);
  return url.toString();
}

export function MapboxLocationPicker({ open, locale, title, value, onPick, onClose }: MapboxLocationPickerProps) {
  const t = useTranslations("locationPicker");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const [pending, setPending] = useState<PickedLocation | null>(value ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "no-token">("idle");

  useEffect(() => {
    if (open) {
      setPending(value ?? null);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    if (!MAPBOX_ACCESS_TOKEN) {
      setStatus("no-token");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    (async () => {
      const mapboxgl = await import("mapbox-gl");
      mapboxgl.default.accessToken = MAPBOX_ACCESS_TOKEN;
      if ((locale === "fa" || locale === "ar") && !rtlTextPluginRegistered) {
        mapboxgl.default.setRTLTextPlugin("/mapbox-gl-rtl-text.js", () => undefined, true);
        rtlTextPluginRegistered = true;
      }
      if (cancelled || !containerRef.current) return;

      const center = value
        ? { latitude: value.latitude, longitude: value.longitude }
        : DEFAULT_COORDINATES;
      const map = new mapboxgl.default.Map({
        container: containerRef.current,
        style: localizedMapboxStyle(locale) ?? "mapbox://styles/mapbox/light-v11",
        center: [center.longitude, center.latitude],
        zoom: value ? 13 : 10,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.default.NavigationControl(), locale === "fa" || locale === "ar" ? "top-left" : "top-right");
      mapRef.current = map;

      const setMarker = (location: PickedLocation) => {
        setPending(location);
        if (!markerRef.current) {
          markerRef.current = new mapboxgl.default.Marker({ color: "#FF6B00" }).setLngLat([location.longitude, location.latitude]).addTo(map);
        } else {
          markerRef.current.setLngLat([location.longitude, location.latitude]);
        }
      };

      map.on("load", () => {
        if (cancelled) return;
        setStatus("ready");
        if (value) setMarker(value);
        setTimeout(() => map.resize(), 80);
      });

      map.on("click", (event) => {
        setMarker({
          latitude: Number(event.lngLat.lat.toFixed(6)),
          longitude: Number(event.lngLat.lng.toFixed(6)),
        });
      });
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locale, open, value]);

  if (!open) return null;

  const confirm = () => {
    if (pending) {
      onPick(pending);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/35 p-0 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t("close")} onClick={onClose} />
      <div className="relative w-full rounded-t-[1.5rem] border border-border bg-background shadow-soft sm:max-w-3xl sm:rounded-[1.5rem]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{title ?? t("title")}</p>
            <p className="mt-1 text-xs text-muted">{pending ? t("selected", { latitude: pending.latitude, longitude: pending.longitude }) : t("hint")}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" aria-label={t("close")}>
            x
          </button>
        </div>
        <div className="relative h-[60svh] max-h-[520px] min-h-[360px]">
          <div ref={containerRef} className="h-full w-full" />
          {status === "loading" ? <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted">{t("loading")}</div> : null}
          {status === "error" || status === "no-token" ? <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-6 text-center text-sm text-muted">{status === "no-token" ? t("noToken") : t("error")}</div> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="halvaa-btn-secondary cursor-pointer">
            {t("cancel")}
          </button>
          <button type="button" onClick={confirm} disabled={!pending} className="halvaa-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
