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
import { MemorialBadge } from "@/components/ui/MemorialBadge";
import { api } from "@/lib/api-client";
import { HALVAA_BLUR_DATA_URL, resolveImageUrl } from "@/lib/blur";
import type { ExploreMemorialFeed } from "@/types/memorial";

type LandingMemorialItem = ExploreMemorialFeed["items"][number];

function fallbackMemorial(
  id: string,
  slug: string,
  name: string,
  subtitle: string,
  imageUrl: string,
): LandingMemorialItem {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id,
    slug,
    name,
    status: "PUBLISHED",
    birth_date: null,
    death_date: null,
    burial_address: null,
    burial_site_name: subtitle,
    burial_plot_name: null,
    category: "remembered",
    metadata: {},
    filter_tags: {},
    latitude: null,
    longitude: null,
    created_at: now,
    updated_at: now,
    published_at: now,
    featured_at: null,
    image_url: imageUrl,
  };
}

const FALLBACK_MEMORIALS: LandingMemorialItem[] = [
  fallbackMemorial("landing-maryam-mirzakhani", "maryam-mirzakhani", "Maryam Mirzakhani", "Mathematician", "/images/Maryam_Mirzakhani-MAIN.jpg"),
  fallbackMemorial("landing-forough-farrokhzad", "forough-farrokhzad", "Forough Farrokhzad", "Poet", "/images/Forough_Farrokhzad_804.jpg"),
  fallbackMemorial("landing-sohrab-sepehri", "sohrab-sepehri", "Sohrab Sepehri", "Poet and painter", "/images/Sohrab-sepehri-1.jpg"),
  fallbackMemorial("landing-nelson-mandela", "nelson-mandela", "Nelson Mandela", "Public servant", "/images/Nelson_Mandela_1994.jpg"),
  fallbackMemorial("landing-mahatma-gandhi", "mahatma-gandhi", "Mahatma Gandhi", "Leader", "/images/Mahatma-Gandhi,_studio,_1931.jpg"),
  fallbackMemorial("landing-mother-teresa", "mother-teresa", "Mother Teresa", "Humanitarian", "/images/MotherTeresa_090.jpg"),
  fallbackMemorial("landing-steve-jobs", "steve-jobs", "Steve Jobs", "Founder", "/images/Steve_Jobs.jpg"),
  fallbackMemorial("landing-kofi-annan", "kofi-annan", "Kofi Annan", "Diplomat", "/images/Kofi_Annan_2012.jpg"),
];

function PhotoCard({
  slug,
  name,
  subtitle,
  imageUrl,
  status,
  isVerified,
  viewCount,
}: {
  slug: string;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  status?: LandingMemorialItem["status"];
  isVerified?: boolean;
  viewCount?: number;
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
          <div className="flex items-start gap-2"><h3 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">{name}</h3><MemorialBadge status={status} isVerified={isVerified} viewCount={viewCount} /></div>
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
  const fallbackCategory = { category: "fallback", label: t("remembered_today"), items: FALLBACK_MEMORIALS };
  const sourceCategories = categories.length ? categories : [fallbackCategory];
  const allUniqueItems = Array.from(
    new Map([...sourceCategories.flatMap((category) => category.items), ...FALLBACK_MEMORIALS].map((item) => [item.slug, item])).values(),
  );
  const usedSlugs = new Set<string>();
  const baseRows = sourceCategories
    .map((category) => {
      const rowItems = Array.from(new Map(category.items.map((item) => [item.slug, item])).values())
        .filter((item) => !usedSlugs.has(item.slug));
      const fillItems = allUniqueItems.filter((item) => !usedSlugs.has(item.slug) && !rowItems.some((rowItem) => rowItem.slug === item.slug));
      const items = [...rowItems, ...fillItems].slice(0, 10);
      items.forEach((item) => usedSlugs.add(item.slug));
      return { ...category, items };
    })
    .filter((category, index) => category.items.length > 0 || (index === 0 && isLoading));
  const showcaseRows = baseRows.length >= 2
    ? baseRows.slice(0, 2)
    : (() => {
        const firstRow = baseRows[0] ?? fallbackCategory;
        const alternateItems = allUniqueItems.filter((item) => !firstRow.items.some((rowItem) => rowItem.slug === item.slug));
        return [
          firstRow,
          {
            ...firstRow,
            category: `${firstRow.category}-second`,
            label: t("loving_memory"),
            items: (alternateItems.length ? alternateItems : [...allUniqueItems].reverse()).slice(0, 10),
          },
        ];
      })();

  return (
    <section className="relative overflow-hidden py-8 sm:py-14">
      <div className="halvaa-container space-y-12">
        {showcaseRows.map((category) => (
          <motion.div key={category.category} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.45 }} className="space-y-5 ltr:text-left rtl:text-right">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="mt-2 text-2xl font-black leading-tight text-foreground sm:text-4xl">
                  {category.label === "Featured by Halvaa" ? t("featured_by_halvaa") : category.label ?? t("remembered_today")}
                </h2>
              </div>
              <Link href="/explore" className="halvaa-btn-secondary hidden sm:inline-flex">{t("see_all")}</Link>
            </div>

            <div className="halvaa-swiper-shell">
              <Swiper modules={[FreeMode]} freeMode spaceBetween={14} slidesOffsetBefore={2} slidesOffsetAfter={2} breakpoints={{ 0: { slidesPerView: 1.35 }, 640: { slidesPerView: 2.75 }, 1024: { slidesPerView: 4.15 } }} dir={rtl ? "rtl" : "ltr"} className="halvaa-swiper">
              {category.items.length === 0 && isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <SwiperSlide key={index}><div className="aspect-[4/5] animate-pulse rounded-[2rem] bg-white/70" /></SwiperSlide>
                  ))
                : category.items.map((item) => (
                    <SwiperSlide key={item.id}>
                      <PhotoCard slug={item.slug} name={item.name} subtitle={item.burial_site_name ?? item.burial_address} imageUrl={item.image_url} status={item.status} isVerified={item.is_verified} viewCount={item.view_count} />
                    </SwiperSlide>
                  ))}
              </Swiper>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
