"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { Link, usePathname } from "@/i18n/routing";

import { LocaleSwitcher } from "./LocaleSwitcher";

type HeaderProps = {
  onSignIn?: () => void;
};

type NavItem = {
  href: "/" | "/explore" | "/memorial/create" | "/store" | "/profile";
  label: string;
  icon: "home" | "explore" | "create" | "store" | "profile";
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") return <svg {...common}><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10.5V20h11v-9.5" /><path d="M10 20v-5h4v5" /></svg>;
  if (name === "explore") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="m14.8 9.2-1.6 4-4 1.6 1.6-4Z" /></svg>;
  if (name === "create") return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  if (name === "store") return <svg {...common}><path d="M4 10h16l-1.5-4h-13Z" /><path d="M5 10v9h14v-9" /><path d="M5 13a3 3 0 0 0 4.5 0 3 3 0 0 0 5 0 3 3 0 0 0 4.5 0" /><path d="M10 19v-4h4v4" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
}

export function Header({ onSignIn }: HeaderProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const isMemorialPage = pathname.includes("/memorial/");

  const navItems: NavItem[] = [
    { href: "/", label: t("home"), icon: "home" },
    { href: "/explore", label: t("explore"), icon: "explore" },
    { href: "/memorial/create", label: t("create"), icon: "create" },
    { href: "/store", label: t("store"), icon: "store" },
    { href: "/profile", label: t("profile"), icon: "profile" },
  ];

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onScroll = () => {
      const scrolled = window.scrollY > 12;
      gsap.to(header, {
        boxShadow: scrolled ? "0 10px 30px rgba(17,17,17,0.08)" : "0 0 0 rgba(17,17,17,0)",
        backgroundColor: scrolled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0)",
        borderColor: scrolled ? "rgba(229,231,235,0.72)" : "rgba(229,231,235,0)",
        backdropFilter: scrolled ? "blur(18px)" : "blur(0px)",
        duration: 0.22,
        ease: "power2.out",
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header ref={headerRef} className={["fixed inset-x-0 top-0 z-50 border-b border-transparent bg-transparent", isMemorialPage ? "mobile-hide-on-memorial" : ""].join(" ")}>
        <div className="halvaa-container flex h-14 items-center justify-between gap-3 md:h-16">
          <Link href="/" className="flex min-w-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Image src="/assets/img/logo.png" alt="Halvaa" width={114} height={60} priority className="h-9 w-auto object-contain md:h-10" />
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-bold md:flex" aria-label={t("aria_label")}>
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={["rounded-full px-4 py-2 transition", active ? "bg-primary text-white" : "text-muted hover:bg-primary/8 hover:text-primary"].join(" ")}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block"><LocaleSwitcher /></div>
            {isAuthenticated && user ? (
              <button type="button" className="halvaa-btn-secondary hidden px-4 py-2 text-sm md:inline-flex" onClick={logout}>{tAuth("sign_out")}</button>
            ) : (
              onSignIn && <button type="button" className="halvaa-btn-primary hidden px-4 py-2 text-sm sm:inline-flex" onClick={onSignIn}>{tAuth("sign_in")}</button>
            )}
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground transition hover:bg-white/60 md:hidden" onClick={() => setDrawerOpen(true)} aria-label={tCommon("menu")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-white/94 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-16px_40px_rgba(17,17,17,0.08)] backdrop-blur-xl md:hidden" aria-label={t("aria_label")}>
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={["flex min-h-13 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition", active ? "bg-primary text-white" : "text-muted"].join(" ")}>
                <NavIcon name={item.icon} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" className="absolute inset-0 bg-black/24 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-label={tCommon("close")} />
          <aside className="absolute bottom-0 top-0 w-[82vw] max-w-xs bg-white p-5 shadow-[0_24px_80px_rgba(17,17,17,0.24)] ltr:right-0 rtl:left-0">
            <div className="flex items-center justify-between gap-3">
              <Image src="/assets/img/logo.png" alt="Halvaa" width={114} height={60} className="h-10 w-auto object-contain" />
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-border" onClick={() => setDrawerOpen(false)} aria-label={tCommon("close")}>×</button>
            </div>
            <div className="mt-5"><LocaleSwitcher /></div>
            <div className="mt-6 space-y-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-black text-foreground">
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-6">
              {isAuthenticated ? (
                <button type="button" className="halvaa-btn-secondary w-full" onClick={logout}>{tAuth("sign_out")}</button>
              ) : (
                onSignIn && <button type="button" className="halvaa-btn-primary w-full" onClick={() => { setDrawerOpen(false); onSignIn(); }}>{tAuth("sign_in")}</button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
