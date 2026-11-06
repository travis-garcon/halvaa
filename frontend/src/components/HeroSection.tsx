"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";

import { MemorialSearchCTA } from "@/components/MemorialSearchCTA";
import { MemorialBadge } from "@/components/ui/MemorialBadge";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api-client";
import { HALVAA_BLUR_DATA_URL, resolveImageUrl } from "@/lib/blur";

type HeroMemorialCard = {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  status?: "PUBLISHED" | "FEATURED";
  isVerified?: boolean;
  viewCount?: number;
};

const FALLBACK_IMAGE = "https://gapgpt.cloud/user_files/44409592-55b7-40e0-82de-ae7bdbd81c81.webp";
const PRIORITY_MEMORIALS: HeroMemorialCard[] = [
  {
    id: "priority-maryam-mirzakhani",
    slug: "maryam-mirzakhani",
    name: "Maryam Mirzakhani",
    subtitle: "Mathematician",
    imageUrl: "/images/Maryam_Mirzakhani-MAIN.jpg",
  },
  {
    id: "priority-mahmoud-hesabi",
    slug: "mahmoud-hesabi",
    name: "Dr. Hessani",
    subtitle: "Scientist",
    imageUrl: "/images/Mahmoud_Hesabi.png",
  },
];

function HeroPhotoCard({ item }: { item: HeroMemorialCard }) {
  const imageUrl = resolveImageUrl(item.imageUrl ?? undefined) ?? FALLBACK_IMAGE;

  return (
    <Link href={`/memorial/${item.slug}`} className="landing-hero-card group">
      <Image
        src={imageUrl}
        alt={item.name}
        fill
        sizes="(max-width: 768px) 42vw, 210px"
        placeholder="blur"
        blurDataURL={HALVAA_BLUR_DATA_URL}
        className="object-cover transition duration-700 group-hover:scale-105"
      />
      <span className="landing-hero-card-overlay" />
      <span className="landing-hero-card-text">
        <span className="flex items-center gap-1.5"><strong>{item.name}</strong><MemorialBadge status={item.status} isVerified={item.isVerified} viewCount={item.viewCount} /></span>
        {item.subtitle ? <small>{item.subtitle}</small> : null}
      </span>
    </Link>
  );
}

function HeroMarqueeColumn({ items, reverse = false }: { items: HeroMemorialCard[]; reverse?: boolean }) {
  const loopItems = items.length > 2 ? [...items, ...items] : items;

  return (
    <div className="landing-hero-marquee-column">
      <div className={reverse ? "landing-hero-marquee-track is-reverse" : "landing-hero-marquee-track"}>
        {loopItems.map((item, index) => (
          <HeroPhotoCard key={`${item.id}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function HeroSection() {
  const t = useTranslations("hero");
  const locale = useLocale();
  const { data } = useSWR(["landing-hero", locale], () => api.landingFeed(locale));
  const apiItems: HeroMemorialCard[] =
    data?.categories.flatMap((category) => category.items).map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      subtitle: item.burial_site_name ?? item.burial_address ?? null,
      imageUrl: item.image_url ?? null,
      status: item.status === "FEATURED" ? "FEATURED" : "PUBLISHED",
      isVerified: item.is_verified,
      viewCount: item.view_count,
    })) ?? [];
  const fallbackItems: HeroMemorialCard[] = [
    ...PRIORITY_MEMORIALS,
    { id: "fallback-2", slug: "ferdowsi", name: "Ferdowsi", subtitle: t("featured.label"), imageUrl: FALLBACK_IMAGE },
    { id: "fallback-3", slug: "parvin-etesami", name: "Parvin Etesami", subtitle: t("featured.label"), imageUrl: FALLBACK_IMAGE },
    { id: "fallback-4", slug: "sohrab-sepehri", name: "Sohrab Sepehri", subtitle: t("featured.label"), imageUrl: FALLBACK_IMAGE },
  ];
  const uniqueItems = Array.from(new Map(apiItems.map((item) => [item.slug, item])).values());
  const prioritySlugs = PRIORITY_MEMORIALS.map((item) => item.slug);
  const priorityItems = PRIORITY_MEMORIALS.map((priority) => ({
    ...priority,
    ...uniqueItems.find((item) => item.slug === priority.slug),
    name: priority.name,
    imageUrl: uniqueItems.find((item) => item.slug === priority.slug)?.imageUrl ?? priority.imageUrl,
  }));
  const remainingItems = uniqueItems.filter((item) => !prioritySlugs.includes(item.slug));
  const items = (uniqueItems.length >= 4 ? [...priorityItems, ...remainingItems] : fallbackItems).slice(0, 10);
  const midpoint = Math.ceil(items.length / 2);

  return (
    <section className="landing-hero">
      <div className="landing-hero-inner">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="landing-hero-copy"
        >
          <p className="landing-hero-eyebrow">{t("featured.label")}</p>
          <h1>
            {t("title.line1")} <span>{t("title.line2")}</span> {t("title.line3")}
          </h1>
          <p>{t("subtitle")}</p>
          <div className="landing-hero-actions">
            <MemorialSearchCTA className="landing-hero-search" />
          </div>
        </motion.div>

        <div className="landing-hero-marquee-wrap" aria-label={t("featured.pagination")}>
          <div className="landing-hero-marquee-stage">
            <HeroMarqueeColumn items={items.slice(0, midpoint)} />
            <HeroMarqueeColumn items={items.slice(midpoint).length ? items.slice(midpoint) : items.slice(0, midpoint)} reverse />
          </div>
        </div>
      </div>
    </section>
  );
}
