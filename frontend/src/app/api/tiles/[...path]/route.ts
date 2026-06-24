import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "https://tiles.openfreemap.org/planet";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const upstreamUrl = `${UPSTREAM}/${path.join("/")}`;
  try {
    const res = await fetch(upstreamUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("Content-Type") ?? "application/x-protobuf");
    headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    headers.set("Access-Control-Allow-Origin", "*");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
