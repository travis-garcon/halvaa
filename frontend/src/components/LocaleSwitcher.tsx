"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";

const locales: { code: Locale; labelKey: "localeEn" | "localeFa" }[] = [
  { code: "en", labelKey: "localeEn" },
  { code: "fa", labelKey: "localeFa" },
];

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1 ltr:flex-row rtl:flex-row-reverse"
      role="group"
      aria-label={t("language")}
    >
      {locales.map((item) => {
        const isActive = locale === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => router.replace(pathname, { locale: item.code })}
            className={[
              "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground",
            ].join(" ")}
            aria-pressed={isActive}
          >
            {t(item.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
