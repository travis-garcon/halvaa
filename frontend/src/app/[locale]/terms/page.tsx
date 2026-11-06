import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/components/LegalPage";
import type { Locale } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legalPages" });

  return (
    <LegalPage
      locale={locale}
      eyebrow={t("eyebrow")}
      lastUpdatedLabel={t("lastUpdated")}
      title={t("terms.title")}
      sections={[
        {
          title: t("terms.use.title"),
          body: [
            t("terms.use.body1"),
            t("terms.use.body2"),
          ],
        },
        {
          title: t("terms.content.title"),
          body: [
            t("terms.content.body1"),
            t("terms.content.body2"),
          ],
        },
        {
          title: t("terms.accounts.title"),
          body: [
            t("terms.accounts.body1"),
            t("terms.accounts.body2"),
          ],
        },
        {
          title: t("terms.purchases.title"),
          body: [
            t("terms.purchases.body1"),
            t("terms.purchases.body2"),
          ],
        },
        {
          title: t("contact.title"),
          body: [t("contact.body")],
        },
      ]}
    />
  );
}
