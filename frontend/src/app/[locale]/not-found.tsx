import { getTranslations } from "next-intl/server";

import { ModernPageShell } from "@/components/ModernPageShell";
import { Link } from "@/i18n/routing";

export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <ModernPageShell>
      <section className="py-24 text-center ltr:text-left rtl:text-right">
        <div className="halvaa-container">
          <h1 className="text-center text-3xl font-bold text-foreground">{t("notFoundTitle")}</h1>
          <p className="mt-4 text-center text-muted">{t("notFoundBody")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="halvaa-btn-primary inline-flex">
              {t("backHome")}
            </Link>
            <Link href="/explore" className="halvaa-btn-secondary inline-flex">
              {t("backExplore")}
            </Link>
          </div>
        </div>
      </section>
    </ModernPageShell>
  );
}
