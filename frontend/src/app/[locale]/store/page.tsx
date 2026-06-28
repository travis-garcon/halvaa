import { setRequestLocale } from "next-intl/server";

import { ModernPageShell } from "@/components/ModernPageShell";
import { StoreClient } from "@/components/store/StoreClient";
import type { Locale } from "@/i18n/routing";

type StorePageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function StorePage({ params }: StorePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <ModernPageShell>
      <StoreClient locale={locale} />
    </ModernPageShell>
  );
}
