import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { MemorialProfile } from "@/components/memorial/MemorialProfile";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type MemorialPageProps = {
  params: Promise<{ locale: Locale; slug: string }>;
};

export default async function MemorialPage({ params }: MemorialPageProps) {
  const { locale, slug } = await params;

  if (!slug) {
    notFound();
  }

  setRequestLocale(locale);
  return (
    <ModernPageShell>
      <MemorialProfile slug={slug} />
    </ModernPageShell>
  );
}
