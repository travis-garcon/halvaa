import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/components/LegalPage";
import type { Locale } from "@/i18n/routing";

type PageProps = {
  params: Promise<{ locale: Locale }>;
};

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legalPages" });

  return (
    <LegalPage
      locale={locale}
      eyebrow={t("eyebrow")}
      lastUpdatedLabel={t("lastUpdated")}
      title={t("privacy.title")}
      sections={[
        {
          title: t("privacy.collect.title"),
          body: [
            t("privacy.collect.body1"),
            t("privacy.collect.body2"),
          ],
        },
        {
          title: t("privacy.use.title"),
          body: [
            t("privacy.use.body1"),
            t("privacy.use.body2"),
          ],
        },
        {
          title: t("privacy.public.title"),
          body: [
            t("privacy.public.body1"),
            t("privacy.public.body2"),
          ],
        },
        {
          title: t("privacy.retention.title"),
          body: [
            t("privacy.retention.body1"),
            t("privacy.retention.body2"),
          ],
        },
        {
          title: t("privacy.security.title"),
          body: [t("privacy.security.body")],
        },
      ]}
    />
  );
}
