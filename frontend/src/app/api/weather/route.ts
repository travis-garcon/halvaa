import { NextRequest, NextResponse } from "next/server";

const WEATHER_BASE_URL = "https://api.open-meteo.com/v1/forecast";

export async function GET(request: NextRequest) {
  const latitude = request.nextUrl.searchParams.get("latitude");
  const longitude = request.nextUrl.searchParams.get("longitude");

  if (!latitude || !longitude) {
    return NextResponse.json({ error: "latitude and longitude are required" }, { status: 400 });
  }

  const upstreamUrl = new URL(WEATHER_BASE_URL);
  upstreamUrl.searchParams.set("latitude", latitude);
  upstreamUrl.searchParams.set("longitude", longitude);
  upstreamUrl.searchParams.set("current", "temperature_2m,weather_code");
  upstreamUrl.searchParams.set("timezone", "auto");

  const response = await fetch(upstreamUrl, {
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 });
  }

  const payload = await response.json();
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
