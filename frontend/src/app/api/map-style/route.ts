import { NextRequest, NextResponse } from "next/server";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

let cached: { json: unknown; ts: number; origin: string } | null = null;
const TTL = 86_400_000;

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const now = Date.now();
  if (!cached || now - cached.ts > TTL || cached.origin !== origin) {
    const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch map style" }, { status: 502 });
    }
    const style: Record<string, unknown> = await res.json();
    rewriteUrls(style, origin);
    cached = { json: style, ts: now, origin };
  }
  return NextResponse.json(cached.json, {
    headers: { "Cache-Control": "public, s-maxage=86400" },
  });
}

const REWRITE_RULES: [string, string][] = [
  ["https://tiles.openfreemap.org/planet/", "/api/tiles/"],
  ["https://tiles.openfreemap.org/planet", "/api/tiles/planet.json"],
  ["https://tiles.openfreemap.org/natural_earth/", "/api/natural_earth/"],
  ["https://tiles.openfreemap.org/sprites/", "/api/sprites/"],
  ["https://tiles.openfreemap.org/fonts/", "/api/fonts/"],
];

function rewriteUrls(obj: unknown, origin: string): void {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i];
      if (typeof item === "string") {
        for (const [from, to] of REWRITE_RULES) {
          if (item.startsWith(from)) {
            obj[i] = origin + to + item.slice(from.length);
            break;
          }
        }
      } else {
        rewriteUrls(item, origin);
      }
    }
  } else if (obj && typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const val = record[key];
      if (typeof val === "string") {
        for (const [from, to] of REWRITE_RULES) {
          if (val.startsWith(from)) {
            record[key] = origin + to + val.slice(from.length);
            break;
          }
        }
      } else {
        rewriteUrls(val, origin);
      }
    }
  }
}
