"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { useDiscoverMemorials } from "@/hooks/use-discover-memorials";
import { Link } from "@/i18n/routing";

export function HeroSection() {
  const locale = useLocale();
  const t = useTranslations("hero");
  const { memorials, isLoading } = useDiscoverMemorials("featured", locale, 3);
  const featuredMemorials = memorials.slice(0, 3);
  const heroItems = isLoading ? [null, null, null] : featuredMemorials;

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="hero-backlight" aria-hidden />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,107,0,0.06),transparent_50%)]"
      />

      <div className="halvaa-container relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-2xl ltr:text-left rtl:text-right"
        >
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            {t("title.line1")}
            <br />
            {t("title.line2")}
            <br />
            {t("title.line3")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-6 text-base leading-8 text-muted sm:text-lg"
          >
            {t("subtitle")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-8 flex flex-wrap gap-4 ltr:justify-start rtl:justify-end"
          >
            <Link href="/memorial/create" className="halvaa-btn-primary">
              {t("btn.create")}
            </Link>
            <Link href="/explore" className="halvaa-btn-secondary">
              {t("btn.explore")}
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="hero-glass-card rounded-3xl border border-border/60 p-8 shadow-soft ltr:text-left rtl:text-right"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-sm font-medium text-primary"
          >
            {t("featured.label")}
          </motion.p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {heroItems.map((memorial, index) => (
              <motion.div
                key={memorial?.id ?? `loading-${index}`}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.12, ease: "easeOut" }}
              >
                {!memorial ? (
                  <div className="hero-placeholder-card aspect-[3/4] rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
                ) : (
                  <Link
                    href={`/memorial/${memorial.slug}`}
                    className="group flex aspect-[3/4] flex-col justify-end rounded-2xl border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,107,0,0.16))] p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="mb-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-base font-semibold text-primary backdrop-blur-sm">
                      {memorial.name.charAt(0)}
                    </div>
                    <div className="rounded-xl bg-white/72 p-3 backdrop-blur-sm">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                        {memorial.name}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">/{memorial.slug}</p>
                    </div>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
