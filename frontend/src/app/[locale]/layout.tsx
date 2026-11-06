import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { routing, type Locale } from "@/i18n/routing";
import { persianSans } from "@/lib/fonts";
import { PWARegister } from "@/components/PWARegister";
import { AppNotifications } from "@/components/ui/AppNotifications";
import { SWRProvider } from "@/providers/SWRProvider";
import { isRtlLocale } from "@/lib/theme";
import "@/styles/globals.css";
import "@/styles/legacy-overrides.css";
import "@/styles/halvaa-ui-polish.css";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
    applicationName: "Halvaa",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Halvaa",
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: "/assets/img/icon.png", type: "image/png", sizes: "400x400" },
        { url: "/assets/img/icon512.png", type: "image/png", sizes: "512x512" },
      ],
      shortcut: [{ url: "/assets/img/icon.png", type: "image/png", sizes: "400x400" }],
      apple: [{ url: "/assets/img/icon512.png", type: "image/png", sizes: "512x512" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/assets/app.css" as="style" />
        <link rel="stylesheet" href="/assets/app.css" />
        <link rel="preload" href="/fonts/iranyekan/fontiran.css" as="style" />
        <link rel="stylesheet" href="/fonts/iranyekan/fontiran.css" />
        <link rel="preload" href="/fonts/google-sans/google-sans.css" as="style" />
        <link rel="stylesheet" href="/fonts/google-sans/google-sans.css" />
        <meta name="theme-color" content="#f4f4f5" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={[
          persianSans.variable,
          isRtlLocale(locale) ? "rtl-mode" : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <NextIntlClientProvider messages={messages}>
          <SWRProvider>
            {children}
            <AppNotifications />
            <PWARegister />
          </SWRProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
