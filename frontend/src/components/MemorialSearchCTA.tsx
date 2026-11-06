"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

type MemorialSearchCTAProps = {
  className?: string;
  compact?: boolean;
};

export function MemorialSearchCTA({ className = "", compact = false }: MemorialSearchCTAProps) {
  const t = useTranslations("explore");

  return (
    <Link
      href="/explore"
      className={[
        "memorial-search-cta group",
        compact ? "memorial-search-cta-compact" : "",
        className,
      ].join(" ").trim()}
      aria-label={t("openModernExplore")}
    >
      <span className="memorial-search-cta-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </span>
      <span className="memorial-search-cta-copy">
        <strong>{t("openModernExplore")}</strong>
      </span>
    </Link>
  );
}
