import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";

import { ModernPageShell } from "@/components/ModernPageShell";
import { StoreInvoiceClient } from "@/components/store/StoreInvoiceClient";
import type { Locale } from "@/i18n/routing";

export default async function StoreInvoicePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ModernPageShell><div className="halvaa-container"><Suspense fallback={null}><StoreInvoiceClient locale={locale} /></Suspense></div></ModernPageShell>;
}
