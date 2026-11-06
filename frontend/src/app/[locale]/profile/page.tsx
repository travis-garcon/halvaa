import { setRequestLocale } from "next-intl/server";

import { ModernPageShell } from "@/components/ModernPageShell";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";
import type { Locale } from "@/i18n/routing";

type ProfilePageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ModernPageShell>
      <section className="profile-page">
        <div className="halvaa-container ltr:text-left rtl:text-right">
          <ProfileDashboard />
        </div>
      </section>
    </ModernPageShell>
  );
}
