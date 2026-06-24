import { getTranslations, setRequestLocale } from "next-intl/server";

import { EditMemorialForm } from "@/components/memorial/EditMemorialForm";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type EditMemorialPageProps = {
  params: Promise<{ locale: Locale; slug: string }>;
};

export default async function EditMemorialPage({ params }: EditMemorialPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("editMemorial");

  return (
    <ModernPageShell>
      <section>
        <div className="halvaa-container max-w-3xl space-y-6 py-4 ltr:text-left rtl:text-right">
          <div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t("title")}</h1>
            <p className="mt-3 text-muted">{t("subtitle")}</p>
          </div>
          <EditMemorialForm slug={slug} />
        </div>
      </section>
    </ModernPageShell>
  );
}
