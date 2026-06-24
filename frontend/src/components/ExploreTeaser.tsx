"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { useDiscoverMemorials } from "@/hooks/use-discover-memorials";
import { Link } from "@/i18n/routing";

function formatDistance(distanceM: number | undefined, locale: string): string | null {
  if (distanceM == null) {
    return null;
  }

  if (distanceM >= 1000) {
    const distanceKm = distanceM / 1000;
    return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
      maximumFractionDigits: distanceKm >= 10 ? 0 : 1,
    }).format(distanceKm);
  }

  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(distanceM);
}

export function ExploreTeaser() {
  const locale = useLocale();
  const t = useTranslations("sections");
  const tExplore = useTranslations("explore");
  const { memorials, error, isLoading } = useDiscoverMemorials("latest", locale, 6);
  const featuredMemorials = memorials.slice(0, 6);

  return (
    <section className="border-t border-border py-20">
      <div className="halvaa-container grid gap-10 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="ltr:text-left rtl:text-right"
        >
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            {t("exploreTitle")}
          </h2>
          <p className="mt-4 text-base leading-8 text-muted">{t("exploreBody")}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
            {!isLoading && featuredMemorials.length > 0 && <span>{tExplore("gridCount", { count: featuredMemorials.length })}</span>}
            {error && featuredMemorials.length > 0 && <span>{tExplore("apiFallback")}</span>}
            {error && featuredMemorials.length === 0 && <span>{tExplore("apiError")}</span>}
          </div>
          <div className="mt-8">
            <Link href="/explore" className="halvaa-btn-secondary inline-flex">
              {tExplore("openModernExplore")}
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {isLoading &&
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="aspect-square rounded-[1.75rem] border border-border bg-background p-4 shadow-soft">
                <div className="skeleton h-full w-full rounded-[1.35rem]" />
              </div>
            ))}

          {!isLoading &&
            featuredMemorials.map((memorial, index) => {
              const distance = formatDistance(memorial.distanceM, locale);
              const distanceUnit = memorial.distanceM == null ? null : memorial.distanceM >= 1000 ? (locale === "fa" ? "کیلومتر" : "km") : (locale === "fa" ? "متر" : "m");

              return (
                <Link
                  key={memorial.id}
                  href={`/memorial/${memorial.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-[1.75rem] border border-border bg-background p-4 shadow-soft transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,0,0.22),transparent_45%),linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,107,0,0.08))]"
                    style={{ opacity: 0.85 - index * 0.08 }}
                  />
                  <div className="relative flex h-full flex-col justify-between rounded-[1.35rem] border border-white/70 bg-white/72 p-4 backdrop-blur-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-lg font-semibold text-primary">
                      {memorial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="line-clamp-2 text-base font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
                        {memorial.name}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted">/{memorial.slug}</p>
                      {distance && distanceUnit && <p className="mt-3 text-xs text-muted">{distance} {distanceUnit}</p>}
                    </div>
                  </div>
                </Link>
              );
            })}

          {!isLoading && featuredMemorials.length === 0 && (
            <div className="col-span-full rounded-[1.75rem] border border-dashed border-border bg-background p-8 text-sm text-muted ltr:text-left rtl:text-right">
              {tExplore("emptyGrid")}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
