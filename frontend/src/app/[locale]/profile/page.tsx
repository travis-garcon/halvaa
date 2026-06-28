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
      <section className="py-5 sm:py-8">
        <div className="halvaa-container space-y-6 ltr:text-left rtl:text-right">
          <div className="app-card rounded-[2rem] p-5 sm:p-8">
            <span className="app-chip">{t("stats.memorials")}</span>
            <h1 className="mt-4 text-4xl font-black leading-tight text-foreground sm:text-6xl">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-muted">{t("subtitle")}</p>
          </div>
          <ProfileDashboard />
        </div>
      </section>
    </ModernPageShell>
  );
}
