"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

export function ModernSiteFooter() {
  const tNav = useTranslations("nav");
  const tHome = useTranslations("home");
  const tCommon = useTranslations("common");

  return (
    <footer className="mt-8 border-t border-border bg-background py-8" role="contentinfo">
      <div className="halvaa-container flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between ltr:text-left rtl:text-right">
        <div>
          <p className="text-lg font-bold text-foreground">Halvaa</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{tHome("footer.tagline")}</p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm font-medium" aria-label={tHome("footer.navLabel")}>
          <Link href="/" className="cursor-pointer transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
            {tNav("home")}
          </Link>
          <Link href="/explore" className="cursor-pointer transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
            {tNav("explore")}
          </Link>
          <Link href="/memorial/create" className="cursor-pointer transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
            {tCommon("create_memorial")}
          </Link>
        </nav>
      </div>
      <div className="halvaa-container mt-6 border-t border-border pt-6 text-center text-xs text-muted sm:text-start">
        {tHome("footer.copyright")}
      </div>
    </footer>
  );
}
