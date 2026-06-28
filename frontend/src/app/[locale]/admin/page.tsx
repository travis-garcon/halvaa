import { setRequestLocale } from "next-intl/server";

import { AdminConsole } from "@/components/admin/AdminConsole";
import { ModernPageShell } from "@/components/ModernPageShell";
import type { Locale } from "@/i18n/routing";

type AdminPageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModernPageShell>
      <AdminConsole locale={locale} />
    </ModernPageShell>
  );
}
