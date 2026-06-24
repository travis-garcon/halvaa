import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModernPageShell } from "@/components/ModernPageShell";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";
import type { Locale } from "@/i18n/routing";

type ProfilePageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  return (
    <ModernPageShell>
      <section>
        <div className="halvaa-container space-y-6 py-4 ltr:text-left rtl:text-right">
          <div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{t("title")}</h1>
            <p className="mt-3 text-muted">{t("subtitle")}</p>
          </div>
          <ProfileDashboard />
        </div>
      </section>
    </ModernPageShell>
  );
}
