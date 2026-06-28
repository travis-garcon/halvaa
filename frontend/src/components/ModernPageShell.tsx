"use client";

import { useState, type ReactNode } from "react";

import { Header } from "@/components/Header";
import { ModernSiteFooter } from "@/components/ModernSiteFooter";
import { AuthModal } from "@/components/legacy/AuthModal";

type ModernPageShellProps = {
  children: ReactNode;
};

export function ModernPageShell({ children }: ModernPageShellProps) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <Header onSignIn={() => setAuthOpen(true)} />
      <main className="min-h-screen pb-24 md:pb-0">{children}</main>
      <ModernSiteFooter />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
