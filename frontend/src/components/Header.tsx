"use client";

import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { Link } from "@/i18n/routing";

import { LocaleSwitcher } from "./LocaleSwitcher";

type HeaderProps = {
  onSignIn?: () => void;
};

export function Header({ onSignIn }: HeaderProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="halvaa-container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="cursor-pointer text-lg font-bold tracking-tight text-foreground ltr:font-sans rtl:font-sans"
        >
          Halvaa
        </Link>

        <nav
          className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm font-medium md:gap-6 ltr:space-x-0 rtl:space-x-reverse"
          aria-label={t("aria_label")}
        >
          <Link
            href="/"
            className="cursor-pointer transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {t("home")}
          </Link>
          <Link
            href="/explore"
            className="cursor-pointer transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {t("explore")}
          </Link>
          <Link
            href="/memorial/create"
            className="cursor-pointer transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {tCommon("create_memorial")}
          </Link>
          <Link
            href="/profile"
            className="cursor-pointer transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            {t("profile")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 ltr:flex-row rtl:flex-row-reverse">
          <LocaleSwitcher />
          {isAuthenticated && user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">{user.full_name}</span>
              <button
                type="button"
                className="halvaa-btn-secondary cursor-pointer whitespace-nowrap px-3 text-sm sm:px-4"
                onClick={logout}
              >
                {tAuth("sign_out")}
              </button>
            </>
          ) : (
            onSignIn && (
              <button
                type="button"
                className="halvaa-btn-primary cursor-pointer whitespace-nowrap px-3 text-sm sm:px-4"
                onClick={onSignIn}
              >
                {tAuth("sign_in")}
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
