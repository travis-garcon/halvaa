/**
 * Map defaults are local-first. The preferred development setup is Docker
 * serving `map-data/halvaa.pmtiles` plus local Protomaps font/sprite assets.
 * Terrain is optional and can be enabled with a local Terrarium DEM PMTiles file.
 * The OpenFreeMap proxy remains as an explicit fallback only.
 */

export const LOCAL_MAP_STYLE_URL = "/api/map-style";
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type LocalMapConfig = {
  enabled: boolean;
  pmtilesUrl: string;
  assetsUrl: string;
  terrainPmtilesUrl: string | null;
};

export function getLocalMapConfig(): LocalMapConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_LOCAL_MAP_ENABLED !== "false",
    pmtilesUrl: process.env.NEXT_PUBLIC_LOCAL_MAP_PM_TILES_URL?.trim() || "http://localhost:8081/halvaa.pmtiles",
    assetsUrl: process.env.NEXT_PUBLIC_LOCAL_MAP_ASSETS_URL?.trim() || "http://localhost:8081/assets/basemaps-assets-main",
    terrainPmtilesUrl: process.env.NEXT_PUBLIC_LOCAL_MAP_TERRAIN_PM_TILES_URL?.trim() || null,
  };
}

export function getMapStyleUrl(): string | null {
  if (getLocalMapConfig().enabled) {
    return null;
  }

  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (configured === "") {
    return null;
  }
  if (configured) {
    return configured.trim();
  }
  return LOCAL_MAP_STYLE_URL;
}

export function getFallbackMapStyleUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (configured && configured.trim() !== "") {
    return configured.trim();
  }
  return LOCAL_MAP_STYLE_URL;
}
