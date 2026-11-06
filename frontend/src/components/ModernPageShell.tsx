"use client";

import { useState, type ReactNode } from "react";
import { useEffect } from "react";

import { Header } from "@/components/Header";
import { ModernSiteFooter } from "@/components/ModernSiteFooter";
import { SmoothScrollEffects } from "@/components/SmoothScrollEffects";
import { AuthModal } from "@/components/legacy/AuthModal";
import { OPEN_AUTH_MODAL_EVENT } from "@/lib/auth-modal-events";
import { usePathname } from "@/i18n/routing";

type ModernPageShellProps = {
  children: ReactNode;
  hideFooter?: boolean;
};

export function ModernPageShell({ children, hideFooter = false }: ModernPageShellProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const open = () => setAuthOpen(true);
    window.addEventListener(OPEN_AUTH_MODAL_EVENT, open);
    return () => window.removeEventListener(OPEN_AUTH_MODAL_EVENT, open);
  }, []);

  return (
    <>
      <SmoothScrollEffects />
      <Header onSignIn={() => setAuthOpen(true)} />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main className="min-h-screen pb-24 md:pb-0">{children}</main>
          {!hideFooter ? <ModernSiteFooter /> : null}
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
