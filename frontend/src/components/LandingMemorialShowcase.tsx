"use client";

import "swiper/css";
import "swiper/css/free-mode";

import Image from "next/image";
import { motion } from "framer-motion";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import { FreeMode } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { Link } from "@/i18n/routing";
import { api } from "@/lib/api-client";
import { HALVAA_BLUR_DATA_URL, resolveImageUrl } from "@/lib/blur";

function PhotoCard({
  slug,
  name,
  subtitle,
  imageUrl,
}: {
  slug: string;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
}) {
  const resolved = resolveImageUrl(imageUrl ?? undefined);
  return (
    <Link href={`/memorial/${slug}`} className="group block overflow-hidden rounded-[2rem] bg-white shadow-[0_18px_55px_rgba(17,17,17,0.08)] transition hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden bg-primary/8">
        {resolved ? (
          <Image src={resolved} alt={name} fill sizes="(max-width: 768px) 80vw, 32vw" placeholder="blur" blurDataURL={HALVAA_BLUR_DATA_URL} className="object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,107,0,0.18),transparent_58%),#fff4ec] text-7xl font-black text-primary">
            {name.charAt(0)}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">{name}</h3>
          {subtitle ? <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/78">{subtitle}</p> : null}
        </div>
      </div>
    </Link>
  );
}

export function LandingMemorialShowcase() {
  const locale = useLocale();
  const t = useTranslations("section");
  const { data, isLoading } = useSWR(["landing", locale], () => api.landingFeed(locale));
  const categories = data?.categories ?? [];
  const rtl = locale === "fa" || locale === "ar";
  const fallbackCategory = { category: "empty", label: t("remembered_today"), items: [] };
  const sourceCategories = categories.length ? categories : [fallbackCategory];
  const showcaseRows = sourceCategories.length > 1
    ? sourceCategories
    : [
        sourceCategories[0],
        {
          ...sourceCategories[0],
          category: `${sourceCategories[0].category}-legacy`,
          label: t("loving_memory"),
        },
      ];

  return (
    <section className="relative overflow-hidden py-8 sm:py-14">
      <div className="overflow-hidden border-y border-border bg-white/74 py-3 backdrop-blur-xl">
        <div className="halvaa-marquee flex min-w-max gap-10 text-xs font-black text-primary sm:text-sm">
          {[t("remembered_today"), t("loving_memory"), t("memorial_anniversaries"), t("recently_passed"), t("top_contributors")].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          {[t("remembered_today"), t("loving_memory"), t("memorial_anniversaries"), t("recently_passed"), t("top_contributors")].map((item, index) => <span key={`${item}-copy-${index}`}>{item}</span>)}
        </div>
      </div>

      <div className="halvaa-container mt-10 space-y-12">
        {showcaseRows.map((category) => (
          <motion.div key={category.category} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.45 }} className="space-y-5 ltr:text-left rtl:text-right">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{category.label ?? category.category}</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-foreground sm:text-4xl">{category.label ?? t("remembered_today")}</h2>
              </div>
              <Link href="/explore" className="halvaa-btn-secondary hidden sm:inline-flex">{t("see_all")}</Link>
            </div>

            <Swiper modules={[FreeMode]} freeMode spaceBetween={14} slidesOffsetBefore={2} slidesOffsetAfter={2} breakpoints={{ 0: { slidesPerView: 1.28 }, 640: { slidesPerView: 2.35 }, 1024: { slidesPerView: 3.35 } }} dir={rtl ? "rtl" : "ltr"} className="!overflow-visible">
              {category.items.length === 0 && isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <SwiperSlide key={index}><div className="aspect-[4/5] animate-pulse rounded-[2rem] bg-white/70" /></SwiperSlide>
                  ))
                : category.items.map((item) => (
                    <SwiperSlide key={item.id}>
                      <PhotoCard slug={item.slug} name={item.name} subtitle={item.burial_site_name ?? item.burial_address} imageUrl={item.image_url} />
                    </SwiperSlide>
                  ))}
            </Swiper>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
