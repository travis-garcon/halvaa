import { getTranslations, setRequestLocale } from "next-intl/server";

import { ExploreHub } from "@/components/explore/ExploreHub";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type ExplorePageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("explore");

  return (
    <ModernPageShell>
      <section>
        <div className="halvaa-container py-4 space-y-6 ltr:text-left rtl:text-right">
          <div>
            <h1 className="text-4xl font-bold text-foreground">{t("title")}</h1>
            <p className="mt-4 max-w-2xl text-muted">{t("subtitle")}</p>
          </div>
          <ExploreHub locale={locale} />
        </div>
      </section>
    </ModernPageShell>
  );
}
