"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";

const locales: { code: Locale; labelKey: "localeEn" | "localeFa" | "localeAr" | "localeZh" }[] = [
  { code: "en", labelKey: "localeEn" },
  { code: "fa", labelKey: "localeFa" },
  { code: "ar", labelKey: "localeAr" },
  { code: "zh", labelKey: "localeZh" },
];

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      className="inline-flex max-w-[9.5rem] items-center gap-1 overflow-x-auto rounded-full border border-border bg-background p-1 sm:max-w-none"
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
