export const HALVAA_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNGRjZCMDAiIGZpbGwtb3BhY2l0eT0iMC4yNSIvPjwvc3ZnPg==";

export function isUploadImageUrl(path: string): boolean {
  try {
    return new URL(path, "http://halvaa.local").pathname.startsWith("/uploads/");
  } catch {
    return path.startsWith("/uploads/");
  }
}

export function resolveImageUrl(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  if (path.startsWith("http://localhost:8000/uploads/") || path.startsWith("https://localhost:8000/uploads/")) {
    return new URL(path).pathname + new URL(path).search;
  }
  if (path.startsWith("http://127.0.0.1:8000/uploads/") || path.startsWith("https://127.0.0.1:8000/uploads/")) {
    return new URL(path).pathname + new URL(path).search;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (
    path.startsWith("/images/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/icons/") ||
    path.startsWith("/favicon") ||
    path.startsWith("/manifest")
  ) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/uploads/")) {
    return normalized;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || apiUrl.startsWith("/")) {
    return normalized;
  }
  return `${apiUrl.replace(/\/api\/v1\/?$/, "")}${normalized}`;
}
