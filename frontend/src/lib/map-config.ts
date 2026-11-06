/**
 * Existing local tile system:
 * - Docker can serve `map-data/halvaa.pmtiles` plus local Protomaps assets.
 * - Terrain is optional with a local Terrarium DEM PMTiles file.
 *
 * Temporary Mapbox-style path:
 * - Set NEXT_PUBLIC_LOCAL_MAP_ENABLED=false.
 * - Set NEXT_PUBLIC_MAP_STYLE_URL to a Mapbox style URL that already includes
 *   the access token, or to any compatible MapLibre style endpoint.
 */

export const LOCAL_MAP_STYLE_URL = "/api/map-style";
export const TEMP_MAPBOX_TOKEN = "pk.eyJ1IjoiYWxpcHViIiwiYSI6ImNrdnpham9odjEwYXYydmxjbjE0bjc3bXQifQ.AwvrtljsjswkpklapUsDTw";
export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || TEMP_MAPBOX_TOKEN;
export const DEFAULT_MAP_STYLE_URL = "mapbox://styles/mapbox/streets-v12";

export type LocalMapConfig = {
  enabled: boolean;
  pmtilesUrl: string;
  assetsUrl: string;
  terrainPmtilesUrl: string | null;
};

export function getLocalMapConfig(): LocalMapConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_LOCAL_MAP_ENABLED === "true",
    pmtilesUrl: process.env.NEXT_PUBLIC_LOCAL_MAP_PM_TILES_URL?.trim() || "http://localhost:8081/halvaa.pmtiles",
    assetsUrl: process.env.NEXT_PUBLIC_LOCAL_MAP_ASSETS_URL?.trim() || "http://localhost:8081/assets/basemaps-assets-main",
    terrainPmtilesUrl: process.env.NEXT_PUBLIC_LOCAL_MAP_TERRAIN_PM_TILES_URL?.trim() || null,
  };
}

export function getMapStyleUrl(): string | null {
  if (getLocalMapConfig().enabled) {
    return null;
  }

  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_MAP_STYLE_URL;
}

export function getFallbackMapStyleUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (configured) {
    return configured;
  }
  return DEFAULT_MAP_STYLE_URL;
}
