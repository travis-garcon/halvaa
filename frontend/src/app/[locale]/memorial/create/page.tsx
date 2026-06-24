import { getTranslations, setRequestLocale } from "next-intl/server";

import { CreateMemorialForm } from "@/components/memorial/CreateMemorialForm";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type CreateMemorialPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function CreateMemorialPage({ params }: CreateMemorialPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("createMemorial");

  return (
    <ModernPageShell>
      <section>
        <div className="halvaa-container max-w-2xl py-4 space-y-6 ltr:text-left rtl:text-right">
          <div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t("title")}</h1>
            <p className="mt-3 text-muted">{t("subtitle")}</p>
          </div>
          <CreateMemorialForm />
        </div>
      </section>
    </ModernPageShell>
  );
}
