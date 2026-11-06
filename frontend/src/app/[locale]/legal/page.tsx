import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/components/LegalPage";
import type { Locale } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function LegalNoticePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legalPages" });

  return (
    <LegalPage
      locale={locale}
      eyebrow={t("eyebrow")}
      lastUpdatedLabel={t("lastUpdated")}
      title={t("notice.title")}
      sections={[
        {
          title: t("notice.operator.title"),
          body: [t("notice.operator.body")],
        },
        {
          title: t("notice.ownership.title"),
          body: [
            t("notice.ownership.body1"),
            t("notice.ownership.body2"),
          ],
        },
        {
          title: t("notice.takedowns.title"),
          body: [t("notice.takedowns.body")],
        },
        {
          title: t("notice.advice.title"),
          body: [t("notice.advice.body")],
        },
        {
          title: t("notice.abuse.title"),
          body: [t("notice.abuse.body")],
        },
      ]}
    />
  );
}
