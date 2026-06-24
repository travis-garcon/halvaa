import { NextResponse } from "next/server";

const UPSTREAM = "https://tiles.openfreemap.org/planet";

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch tile JSON" }, { status: 502 });
    }
    const tilejson: Record<string, unknown> = await res.json();

    if (Array.isArray(tilejson.tiles)) {
      tilejson.tiles = tilejson.tiles.map((url: string) => {
        if (typeof url === "string" && url.startsWith("https://tiles.openfreemap.org/planet/")) {
          return "/api/tiles/" + url.slice("https://tiles.openfreemap.org/planet/".length);
        }
        return url;
      });
    }

    return NextResponse.json(tilejson, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Tile JSON proxy failed" }, { status: 502 });
  }
}
