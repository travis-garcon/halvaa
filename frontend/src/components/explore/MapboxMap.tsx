"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_COORDINATES } from "@/hooks/use-geolocation";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { getSampleGridMemorials } from "@/lib/explore-data";
import { MAPBOX_ACCESS_TOKEN, getMapStyleUrl } from "@/lib/map-config";
import type { GeoJSONFeatureCollection } from "@/types/memorial";
import type { GeoJSONSource, Map as MapboxMapInstance } from "mapbox-gl";

type MapboxMapProps = {
  locale: string;
  collection?: GeoJSONFeatureCollection;
  className?: string;
};

let rtlTextPluginRegistered = false;

const MAP_LABEL_FONT_MEDIUM = ["Noto Sans Medium"];
// Temporary local-map note:
// The previous MapLibre + PMTiles implementation is intentionally parked while
// Explore uses Mapbox GL. `src/app/api/map-style` and local tile routes remain
// in the app so the offline path can be restored later.

function sampleCollection(locale: string): GeoJSONFeatureCollection {
  const samples = getSampleGridMemorials(locale).slice(0, 6);
  return {
    type: "FeatureCollection",
    features: samples.map((item, index) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          DEFAULT_COORDINATES.longitude + index * 0.01,
          DEFAULT_COORDINATES.latitude + index * 0.008,
        ],
      },
      properties: {
        id: item.id,
        slug: item.slug,
        name: item.name,
        distance_m: index * 420,
      },
    })),
  };
}

function emptyCollection(): GeoJSONFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

function formatDistance(meters: number, locale: string): string {
  const formatter = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    maximumFractionDigits: meters >= 1000 && meters < 10_000 ? 1 : 0,
  });

  if (meters >= 1000) {
    return `${formatter.format(meters / 1000)} ${locale === "fa" ? "کیلومتر" : "km"}`;
  }
  return `${formatter.format(Math.round(meters))} ${locale === "fa" ? "متر" : "m"}`;
}

function withMapboxToken(url: string): string {
  if (!url.includes("mapbox.com") || url.includes("access_token=")) {
    return url;
  }
  if (!MAPBOX_ACCESS_TOKEN) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}access_token=${MAPBOX_ACCESS_TOKEN}`;
}

export function MapboxMap({ locale, collection, className = "" }: MapboxMapProps) {
  const t = useTranslations("explore");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMapInstance | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-style" | "empty">("loading");
  const [featureCount, setFeatureCount] = useState(0);
  const [locating, setLocating] = useState(false);

  const sourceData = useMemo(() => {
    if (collection && collection.features.length > 0) {
      return collection;
    }
    if (isDemoFallbackEnabled()) {
      return sampleCollection(locale);
    }
    return emptyCollection();
  }, [collection, locale]);

  const dataKey = useMemo(
    () =>
      sourceData.features
        .map((feature) => `${feature.properties.id}:${feature.properties.slug}`)
        .join("|"),
    [sourceData],
  );

  const mapStyle = useMemo(() => getMapStyleUrl(), []);
  const hasStyleUrl = !!mapStyle;
  const hasFeatures = sourceData.features.length > 0;

  useEffect(() => {
    if (!hasStyleUrl || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;

    const centerFeature = sourceData.features[0];
    const center = centerFeature
      ? {
          longitude: centerFeature.geometry.coordinates[0],
          latitude: centerFeature.geometry.coordinates[1],
        }
      : DEFAULT_COORDINATES;

    const styleTimeout = setTimeout(() => {
      if (!cancelled) {
        setStatus("error");
      }
    }, 20_000);

    (async () => {
      const { default: mapboxgl } = await import("mapbox-gl");
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
      if (!rtlTextPluginRegistered) {
        mapboxgl.setRTLTextPlugin("/mapbox-gl-rtl-text.js", () => undefined, true);
        rtlTextPluginRegistered = true;
      }
      if (cancelled) return;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: mapStyle,
        center: [center.longitude, center.latitude],
        zoom: 11,
        bearing: -18,
        pitch: 45,
        maxPitch: 75,
        attributionControl: false,
        logoPosition: "bottom-left",
        transformRequest: (url) => ({ url: withMapboxToken(url) }),
      });

      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        setFeatureCount(sourceData.features.length);

        clearTimeout(styleTimeout);

        const languageField = locale === "fa" ? "name_fa" : locale === "ar" ? "name_ar" : locale === "zh" ? "name_zh-Hans" : "name_en";
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
            try {
              map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", languageField], ["get", "name_en"], ["get", "name"]]);
            } catch {
              // Some Mapbox layers reject runtime localization expressions.
            }
          }
        });

        if (map.getSource("memorials")) {
          (map.getSource("memorials") as GeoJSONSource).setData(sourceData);
        } else {
          map.addSource("memorials", {
            type: "geojson",
            data: sourceData,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 48,
          });

          map.addLayer({
            id: "memorials-clusters",
            type: "circle",
            source: "memorials",
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 25, 32],
              "circle-color": "#0F172A",
              "circle-opacity": 0.88,
              "circle-stroke-width": 3,
              "circle-stroke-color": "#FFFFFF",
            },
          });

          map.addLayer({
            id: "memorials-cluster-count",
            type: "symbol",
            source: "memorials",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": MAP_LABEL_FONT_MEDIUM,
              "text-size": 12,
            },
            paint: {
              "text-color": "#FFFFFF",
            },
          });

          map.addLayer({
            id: "memorials-halo",
            type: "circle",
            source: "memorials",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": 16,
              "circle-color": "#FF6B00",
              "circle-opacity": 0.18,
            },
          });

          map.addLayer({
            id: "memorials-point",
            type: "circle",
            source: "memorials",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": 7,
              "circle-color": "#FF6B00",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
            },
          });

          map.on("click", "memorials-clusters", (event) => {
            const feature = event.features?.[0];
            const clusterId = feature?.properties?.cluster_id;
            if (clusterId !== undefined) {
              const source = map.getSource("memorials") as GeoJSONSource & {
                getClusterLeaves?: (clusterId: number, limit: number, offset: number) => Promise<Array<{ properties?: Record<string, unknown> }>>;
              };
              if (source?.getClusterLeaves) {
                void source.getClusterLeaves(Number(clusterId), 12, 0).then((leaves) => {
                  const memorials = leaves
                    .map((leaf) => leaf.properties)
                    .filter(Boolean)
                    .map((props) => {
                      const name = String(props?.name || props?.slug || "");
                      const slug = String(props?.slug || "");
                      const site = String(props?.burial_site_name || "");
                      const plot = String(props?.burial_plot_name || "");
                      return `<li style="margin:4px 0"><a href="/${locale}/memorial/${escapeHtml(slug)}" style="color:#0369A1;font-weight:600">${escapeHtml(name)}</a>${site || plot ? `<div style="font-size:12px;color:#64748b">${escapeHtml([site, plot].filter(Boolean).join(" · "))}</div>` : ""}</li>`;
                    })
                    .join("");
                  if (memorials) {
                    new mapboxgl.Popup({ offset: 18, closeButton: true })
                      .setLngLat(event.lngLat)
                      .setHTML(`<div style="min-width:200px"><strong>${escapeHtml(t("clusterTitle"))}</strong><ul style="margin:8px 0 0;padding-left:18px">${memorials}</ul></div>`)
                      .addTo(map);
                  }
                });
              }
            }
            const coordinates = feature?.geometry.type === "Point" ? feature.geometry.coordinates : null;
            if (coordinates) {
              map.easeTo({ center: coordinates as [number, number], zoom: Math.min(map.getZoom() + 2, 15) });
            }
          });

          map.on("click", "memorials-point", (event) => {
            const feature = event.features?.[0];
            const slug = feature?.properties?.slug;
            const name = feature?.properties?.name || slug;
            const distance = Number(feature?.properties?.distance_m || 0);
            const site = feature?.properties?.burial_site_name;
            const plot = feature?.properties?.burial_plot_name;
            const coordinates = feature?.geometry.type === "Point" ? feature.geometry.coordinates : null;
            if (slug && coordinates) {
              new mapboxgl.Popup({ offset: 18, closeButton: true })
                .setLngLat(coordinates as [number, number])
                .setHTML(
                  `<div style="min-width:160px"><strong>${escapeHtml(String(name))}</strong>${site || plot ? `<p style="margin:6px 0;color:#64748b">${escapeHtml([site, plot].filter(Boolean).join(" · "))}</p>` : ""}<p style="margin:6px 0;color:#64748b">${formatDistance(distance, locale)}</p><a href="/${locale}/memorial/${escapeHtml(String(slug))}" style="color:#0369A1;font-weight:600">${escapeHtml(t("openMemorial"))}</a></div>`,
                )
                .addTo(map);
            }
          });

          map.on("mouseenter", "memorials-point", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "memorials-point", () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("mouseenter", "memorials-clusters", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "memorials-clusters", () => {
            map.getCanvas().style.cursor = "";
          });
        }

        setStatus("ready");
      });
    })().catch(() => {
      if (!cancelled) {
        clearTimeout(styleTimeout);
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(styleTimeout);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [locale, dataKey, hasStyleUrl, sourceData, mapStyle, t]);

  const ready = status === "ready" && hasFeatures;

  const locateUser = () => {
    if (!navigator.geolocation || !mapRef.current) {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        mapRef.current?.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 13,
          pitch: 45,
          duration: 700,
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 },
    );
  };

  return (
    <div className={`relative w-full ltr:text-left rtl:text-right ${className}`.trim()}>
      <div
        ref={mapContainerRef}
        className="h-[420px] w-full overflow-hidden rounded-[2rem] border border-border"
        aria-label={t("mapLabel")}
      />

      {hasStyleUrl && status !== "error" && (
        <div className="explore-map-gps-control">
          <button
            type="button"
            onClick={locateUser}
            disabled={locating}
            aria-label={locating ? t("mapLocating") : t("mapLocate")}
            title={locating ? t("mapLocating") : t("mapLocate")}
            className="explore-map-gps-button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
              <path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3" />
            </svg>
          </button>
        </div>
      )}

      {!hasStyleUrl && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-background/90 p-6 text-center text-sm text-muted">
          {t("mapNoToken")}
        </div>
      )}

      {hasStyleUrl && status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[2rem] bg-background/70 text-sm text-muted">
          {t("mapLoading")}
        </div>
      )}

      {hasStyleUrl && status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-background/90 p-6 text-center text-sm text-muted">
          {t("mapError")}
        </div>
      )}

      {hasStyleUrl && status === "ready" && !hasFeatures && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[2rem] bg-background/10 p-6 text-center text-sm text-muted backdrop-blur-[1px]">
          {t("mapEmpty")}
        </div>
      )}

      {ready && (
        <p className="mt-3 text-center text-xs text-muted">
          {t("mapCount", { count: featureCount })}
        </p>
      )}
    </div>
  );
}
