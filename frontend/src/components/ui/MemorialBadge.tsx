"use client";

import { useTranslations } from "next-intl";

import type { MemorialStatus } from "@/types/memorial";

export const POPULAR_MEMORIAL_VIEW_THRESHOLD = 1000;

export type MemorialBadgeKind = "featured" | "verified" | "popular";

export function getMemorialBadgeKind(
  status: MemorialStatus | undefined,
  isVerified = false,
  viewCount = 0,
): MemorialBadgeKind | null {
  if (status === "FEATURED") return "featured";
  if (isVerified) return "verified";
  if (viewCount >= POPULAR_MEMORIAL_VIEW_THRESHOLD) return "popular";
  return null;
}

type MemorialBadgeProps = {
  status?: MemorialStatus;
  isVerified?: boolean;
  viewCount?: number;
  showLabel?: boolean;
  className?: string;
};

export function MemorialBadge({
  status,
  isVerified = false,
  viewCount = 0,
  showLabel = false,
  className = "",
}: MemorialBadgeProps) {
  const t = useTranslations("memorialBadges");
  const kind = getMemorialBadgeKind(status, isVerified, viewCount);
  if (!kind) return null;

  return (
    <span
      className={["memorial-badge", `is-${kind}`, showLabel ? "has-label" : "", className].filter(Boolean).join(" ")}
      title={t(`${kind}.description`)}
      aria-label={t(`${kind}.description`)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {kind === "featured" ? (
          <>
            <path d="M12 2.7 14 5l3-.3.8 2.8 2.7 1.4-1.1 2.8 1.1 2.8-2.7 1.4-.8 2.8-3-.3-2 2.3-2-2.3-3 .3-.8-2.8-2.7-1.4 1.1-2.8-1.1-2.8 2.7-1.4.8-2.8 3 .3Z" />
            <path d="m12 7.2 1.45 2.95 3.25.47-2.35 2.29.55 3.23L12 14.62l-2.9 1.52.55-3.23-2.35-2.29 3.25-.47Z" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m7.8 12.2 2.7 2.7 5.8-6" />
          </>
        )}
      </svg>
      {showLabel ? <span>{t(`${kind}.label`)}</span> : null}
    </span>
  );
}
