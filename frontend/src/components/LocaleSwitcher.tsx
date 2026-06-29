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
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("language")}</span>
      <select
        value={locale}
        onChange={(event) => router.replace(pathname, { locale: event.target.value as Locale })}
        className="min-h-10 cursor-pointer appearance-none rounded-full border border-border bg-background py-2 pl-4 pr-9 text-xs font-black text-foreground shadow-sm outline-none transition hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20 rtl:pl-9 rtl:pr-4"
        aria-label={t("language")}
      >
        {locales.map((item) => (
          <option key={item.code} value={item.code}>
            {t(item.labelKey)}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 h-4 w-4 text-muted rtl:left-3 rtl:right-auto" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
      </svg>
    </label>
  );
}
