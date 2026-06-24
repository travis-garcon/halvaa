export const HALVAA_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNGRjZCMDAiIGZpbGwtb3BhY2l0eT0iMC4yNSIvPjwvc3ZnPg==";

export function resolveImageUrl(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const apiOrigin = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
  ).replace(/\/api\/v1\/?$/, "");

  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiOrigin}${normalized}`;
}
