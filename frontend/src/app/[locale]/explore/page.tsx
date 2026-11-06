import { setRequestLocale } from "next-intl/server";

import { ExploreHub } from "@/components/explore/ExploreHub";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type ExplorePageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModernPageShell hideFooter>
      <ExploreHub locale={locale} />
    </ModernPageShell>
  );
}
