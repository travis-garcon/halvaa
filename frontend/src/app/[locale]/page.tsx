import { setRequestLocale } from "next-intl/server";

import { ExploreTeaser } from "@/components/ExploreTeaser";
import { HeroSection } from "@/components/HeroSection";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type HomePageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModernPageShell>
      <HeroSection />
      <ExploreTeaser />
    </ModernPageShell>
  );
}
