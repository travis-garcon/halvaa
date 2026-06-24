import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "https://tiles.openfreemap.org/natural_earth";

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
    headers.set("Content-Type", res.headers.get("Content-Type") ?? "image/png");
    headers.set("Cache-Control", "public, s-maxage=86400");
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
