"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_COORDINATES } from "@/hooks/use-geolocation";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { getSampleGridMemorials } from "@/lib/explore-data";
import { getFallbackMapStyleUrl, getLocalMapConfig, getMapStyleUrl, type LocalMapConfig } from "@/lib/map-config";
import type { GeoJSONFeatureCollection } from "@/types/memorial";
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

type MapboxMapProps = {
  locale: string;
  collection?: GeoJSONFeatureCollection;
  className?: string;
};

let pmtilesProtocolRegistered = false;
let rtlTextPluginRegistered = false;

const MAP_LABEL_FONT = ["Noto Sans Regular"];
const MAP_LABEL_FONT_MEDIUM = ["Noto Sans Medium"];

function createLocalMapStyle(config: LocalMapConfig, locale: string): StyleSpecification {
  const baseLayers = layers("protomaps", namedFlavor("light"), { lang: locale === "fa" || locale === "ar" ? locale : "en" }) as StyleSpecification["layers"];
  const localizedBaseLayers = baseLayers.map((layer) => {
    if (layer.type !== "symbol") {
      return layer;
    }

    return {
      ...layer,
      layout: {
        ...layer.layout,
        "text-font": MAP_LABEL_FONT,
      },
    };
  });
  const firstSymbolLayer = localizedBaseLayers.findIndex((layer) => layer.type === "symbol");
  const terrainLayers: LayerSpecification[] = config.terrainPmtilesUrl
    ? [
        {
          id: "halvaa-hillshade",
          type: "hillshade",
          source: "terrain-dem",
          minzoom: 7,
          paint: {
            "hillshade-exaggeration": 0.35,
            "hillshade-shadow-color": "#56463a",
            "hillshade-highlight-color": "#fff7ef",
            "hillshade-accent-color": "#d9c3aa",
          },
        },
      ]
    : [];
  const buildingExtrusionLayer: LayerSpecification = {
    id: "halvaa-3d-buildings",
    type: "fill-extrusion",
    source: "protomaps",
    "source-layer": "buildings",
    minzoom: 11,
    filter: ["in", ["get", "kind"], ["literal", ["building", "building_part"]]],
    paint: {
      "fill-extrusion-color": [
        "case",
        ["==", ["get", "kind"], "building_part"],
        "#d8cdc0",
        ["interpolate", ["linear"], ["coalesce", ["get", "height"], 20], 0, "#efe5da", 80, "#cdb79d"],
      ],
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 10.8, 0, 12.2, ["coalesce", ["get", "height"], 18]],
      "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      "fill-extrusion-opacity": 0.84,
      "fill-extrusion-vertical-gradient": true,
    },
  };
  const styleLayers = [...terrainLayers, ...localizedBaseLayers];
  styleLayers.splice(firstSymbolLayer >= 0 ? firstSymbolLayer : styleLayers.length, 0, buildingExtrusionLayer);

  return {
    version: 8,
    light: {
      anchor: "viewport",
      color: "#FFF3E0",
      intensity: 0.45,
      position: [1.2, 160, 35],
    },
    glyphs: `${config.assetsUrl}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${config.assetsUrl}/sprites/v4/light`,
    sources: {
      ...(config.terrainPmtilesUrl
        ? {
            "terrain-dem": {
              type: "raster-dem",
              url: `pmtiles://${config.terrainPmtilesUrl}`,
              tileSize: 256,
              maxzoom: 14,
              encoding: "terrarium",
            } as const,
          }
        : {}),
      protomaps: {
        type: "vector",
        url: `pmtiles://${config.pmtilesUrl}`,
        attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: styleLayers,
  };
}

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

export function MapboxMap({ locale, collection, className = "" }: MapboxMapProps) {
  const t = useTranslations("explore");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-style" | "empty">("loading");
  const [featureCount, setFeatureCount] = useState(0);
  const [tilted, setTilted] = useState(true);
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

  const localMapConfig = useMemo(() => getLocalMapConfig(), []);
  const mapStyle = useMemo(
    () => (localMapConfig.enabled ? createLocalMapStyle(localMapConfig, locale) : getMapStyleUrl()),
    [localMapConfig, locale],
  );
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
      let resolvedStyle = mapStyle;
      if (localMapConfig.enabled) {
        try {
          const localMapHealthUrl = new URL("/health.txt", localMapConfig.pmtilesUrl).toString();
          const healthResponse = await fetch(localMapHealthUrl, { cache: "no-store" });
          if (!healthResponse.ok) {
            throw new Error(`Local map unavailable (${healthResponse.status})`);
          }
        } catch {
          resolvedStyle = getFallbackMapStyleUrl();
        }
      }

      const { default: maplibregl } = await import("maplibre-gl");
      if (localMapConfig.enabled && !pmtilesProtocolRegistered) {
        const { Protocol } = await import("pmtiles");
        const protocol = new Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);
        pmtilesProtocolRegistered = true;
      }
      if ((locale === "fa" || locale === "ar") && !rtlTextPluginRegistered) {
        maplibregl.setRTLTextPlugin("/mapbox-gl-rtl-text.js", true);
        rtlTextPluginRegistered = true;
      }
      if (cancelled) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: resolvedStyle,
        center: [center.longitude, center.latitude],
        zoom: 11,
        bearing: -18,
        pitch: 45,
        maxPitch: 75,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), locale === "fa" || locale === "ar" ? "top-left" : "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        setFeatureCount(sourceData.features.length);

        try {
          if (localMapConfig.terrainPmtilesUrl && map.getSource("terrain-dem")) {
            map.setTerrain({ source: "terrain-dem", exaggeration: 1.2 });
          }
        } catch {
          // terrain is optional — map still works without it
        }

        clearTimeout(styleTimeout);

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
                    new maplibregl.Popup({ offset: 18, closeButton: true })
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
              new maplibregl.Popup({ offset: 18, closeButton: true })
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
  }, [locale, dataKey, hasStyleUrl, sourceData, mapStyle, localMapConfig, t]);

  const ready = status === "ready" && hasFeatures;

  const toggleTilt = () => {
    const nextTilted = !tilted;
    setTilted(nextTilted);
    mapRef.current?.easeTo({ pitch: nextTilted ? 45 : 0, duration: 450 });
  };

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
          pitch: tilted ? 45 : 0,
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
        <div className="absolute top-4 flex gap-2 rounded-full border border-border bg-background/90 p-1 shadow-soft backdrop-blur ltr:left-4 rtl:right-4">
          <button
            type="button"
            onClick={toggleTilt}
            className="cursor-pointer rounded-full px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {tilted ? t("mapFlat") : t("map3d")}
          </button>
          <button
            type="button"
            onClick={locateUser}
            disabled={locating}
            className="cursor-pointer rounded-full px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {locating ? t("mapLocating") : t("mapLocate")}
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
