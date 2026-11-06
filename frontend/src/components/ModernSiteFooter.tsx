"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

export function ModernSiteFooter() {
  const tNav = useTranslations("nav");
  const tHome = useTranslations("home");
  const tCommon = useTranslations("common");
  const tFooter = useTranslations("footer");
  const legalLinks = [
    { href: "/terms", label: tFooter("terms") },
    { href: "/privacy", label: tFooter("privacy") },
    { href: "/legal", label: tFooter("legal") },
  ] as const;
  const mobileRows = [
    [
      { href: "/", label: tNav("home") },
      { href: "/explore", label: tNav("explore") },
      { href: "/memorial/create", label: tCommon("create_memorial") },
      { href: "/store", label: tNav("store") },
    ],
    [
      { href: "/profile", label: tNav("profile") },
      { href: "/explore", label: tFooter("discover") },
      { href: "/terms", label: tFooter("terms") },
      { href: "/privacy", label: tFooter("privacy") },
    ],
  ] as const;

  return (
    <footer className="mt-8 border-t border-border bg-background py-10" role="contentinfo">
      <div className="halvaa-container flex flex-col items-center gap-5 pb-24 sm:hidden">
        <img src="/assets/img/logo.png" alt="Halvaa" className="h-11 w-auto opacity-60 grayscale contrast-0" />
        <div className="flex w-full flex-col items-center gap-2 text-xs text-muted">
          {mobileRows.map((row, rowIndex) => (
            <nav key={rowIndex} className="flex flex-wrap items-center justify-center" aria-label={rowIndex === 0 ? tFooter("product") : tFooter("legal")}>
              {row.map((item, index) => (
                <span key={item.href} className="inline-flex items-center">
                  {index > 0 ? <span className="px-2 text-border" aria-hidden="true">•</span> : null}
                  <Link href={item.href} className="text-muted no-underline transition hover:text-foreground">{item.label}</Link>
                </span>
              ))}
            </nav>
          ))}
        </div>
        <a href="mailto:support@halvaa.app" className="text-xs text-muted no-underline">support@halvaa.app</a>
        <p className="text-center text-[11px] text-muted">{tHome("footer.copyright")}</p>
      </div>
      <div className="halvaa-container hidden gap-8 ltr:text-left rtl:text-right sm:grid sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div className="max-w-sm">
          <img src="/assets/img/logo.png" alt="Halvaa" className="h-12 w-auto p-1 opacity-55 grayscale contrast-0" />
          <p className="mt-2 text-sm leading-6 text-muted">{tHome("footer.tagline")}</p>
          <p className="mt-4 text-xs leading-5 text-muted">{tFooter("description")}</p>
        </div>

        <nav className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-1" aria-label={tFooter("product")}>
          <p className="col-span-2 text-xs font-black uppercase tracking-[0.18em] text-foreground sm:col-span-1">{tFooter("product")}</p>
          <Link href="/" className="cursor-pointer text-muted transition hover:text-primary">{tNav("home")}</Link>
          <Link href="/explore" className="cursor-pointer text-muted transition hover:text-primary">{tNav("explore")}</Link>
          <Link href="/memorial/create" className="cursor-pointer text-muted transition hover:text-primary">{tCommon("create_memorial")}</Link>
          <Link href="/store" className="cursor-pointer text-muted transition hover:text-primary">{tNav("store")}</Link>
        </nav>

        <nav className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-1" aria-label={tFooter("support")}>
          <p className="col-span-2 text-xs font-black uppercase tracking-[0.18em] text-foreground sm:col-span-1">{tFooter("support")}</p>
          <Link href="/profile" className="cursor-pointer text-muted transition hover:text-primary">{tNav("profile")}</Link>
          <Link href="/explore" className="cursor-pointer text-muted transition hover:text-primary">{tFooter("discover")}</Link>
          <a href="mailto:support@halvaa.app" className="cursor-pointer text-muted transition hover:text-primary">support@halvaa.app</a>
        </nav>

        <nav className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-1" aria-label={tFooter("legal")}>
          <p className="col-span-2 text-xs font-black uppercase tracking-[0.18em] text-foreground sm:col-span-1">{tFooter("legal")}</p>
          {legalLinks.map((item) => (
            <Link key={item.href} href={item.href} className="cursor-pointer text-muted transition hover:text-primary">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="halvaa-container mt-8 hidden flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex sm:flex-row sm:items-center sm:justify-between">
        <span>{tHome("footer.copyright")}</span>
        <span>{tFooter("userContent")}</span>
      </div>
    </footer>
  );
}
