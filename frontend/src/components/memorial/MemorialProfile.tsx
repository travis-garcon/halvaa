"use client";

import "swiper/css";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Swiper, SwiperSlide } from "swiper/react";

import { ContributionBox } from "@/components/memorial/ContributionBox";
import { GuestbookSection } from "@/components/memorial/GuestbookSection";
import { MemorialTimeline } from "@/components/memorial/MemorialTimeline";
import { MemorialThemeRoot } from "@/components/MemorialThemeRoot";
import { MemorialImage } from "@/components/ui/MemorialImage";
import { MemorialBadge } from "@/components/ui/MemorialBadge";
import { useMemorial } from "@/hooks/use-memorial";
import { Link } from "@/i18n/routing";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { isSampleSlug, getSampleNameBySlug } from "@/lib/explore-data";
import { api, ApiError } from "@/lib/api-client";
import { isUploadImageUrl, resolveImageUrl } from "@/lib/blur";
import { getMemorialDisplayName, memorialToTimeline } from "@/lib/memorial-adapters";
import { getSampleTimeline } from "@/lib/sample-timeline";
import type { MediaPublic, MemorialLocation, MemorialProfile as MemorialProfileData } from "@/types/memorial";

type MemorialProfileProps = {
  slug: string;
};

type MemorialHeaderViewModel = {
  title: string;
  slug: string;
  status: MemorialProfileData["status"];
  isVerified: boolean;
  viewCount: number;
  coverUrl: string | null;
  portraitUrl: string | null;
  subtitle: string | null;
  dateRange: string | null;
  restingPlace: string | null;
  announcement: string | null;
  biography: string | null;
  epitaph: string | null;
  guestbookCount: number;
  timelineCount: number;
  galleryCount: number;
  qrCodeUrl: string | null;
};

function SkeletonProfile({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="pb-16">
      <div className="h-[260px] w-full bg-primary/5 sm:h-[320px]" />
      <div className="halvaa-container -mt-20 space-y-8 pb-4 ltr:text-left rtl:text-right">
        <div className="rounded-[2rem] border border-border bg-background p-6 shadow-soft sm:p-8">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="skeleton h-28 w-28 rounded-full" />
            <div className="space-y-3">
              <div className="skeleton mx-auto h-4 w-36" />
              <div className="skeleton mx-auto h-10 w-64" />
              <div className="skeleton mx-auto h-4 w-72" />
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border border-border/80 p-4">
                  <div className="skeleton mx-auto h-7 w-12" />
                  <div className="skeleton mx-auto mt-2 h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {[1, 2].map((item) => (
            <div key={item} className="rounded-[2rem] border border-border bg-background p-6 shadow-soft sm:p-8">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton mt-4 h-8 w-40" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatSingleDate(date: string | null | undefined, locale: string): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateRange(birthDate: string | null, deathDate: string | null, locale: string): string | null {
  const birth = formatSingleDate(birthDate, locale);
  const death = formatSingleDate(deathDate, locale);

  if (birth && death) {
    return `${birth} - ${death}`;
  }
  return birth ?? death ?? null;
}

function getTranslationLayer(memorial: MemorialProfileData, locale: string): Record<string, string> {
  return memorial.translations[locale] ?? memorial.translations.en ?? Object.values(memorial.translations)[0] ?? {};
}

function getMediaMeta(item: { translations?: Record<string, unknown> }) {
  const meta = item.translations?.meta;
  return typeof meta === "object" && meta ? (meta as Record<string, unknown>) : {};
}

function buildHeaderModel(memorial: MemorialProfileData, locale: string): MemorialHeaderViewModel {
  const layer = getTranslationLayer(memorial, locale);
  const title = getMemorialDisplayName(memorial, locale);
  const selectedBanner = memorial.gallery.find((item) => getMediaMeta(item).header_role === "banner");
  const selectedPortrait = memorial.gallery.find((item) => getMediaMeta(item).header_role === "portrait");
  const firstImage = memorial.gallery[0] ?? null;
  const cover = selectedBanner?.thumbnail_url ?? selectedBanner?.original_url ?? firstImage?.thumbnail_url ?? firstImage?.original_url ?? null;
  const portrait = selectedPortrait?.thumbnail_url ?? selectedPortrait?.original_url ?? cover;
  const dateRange = formatDateRange(memorial.birth_date, memorial.death_date, locale);
  const subtitle = layer.occupation ?? layer.subtitle ?? layer.role ?? null;
  const restingPlace = [memorial.burial_site_name, memorial.burial_plot_name, memorial.burial_address].filter(Boolean).join(" · ") || null;

  return {
    title,
    slug: memorial.slug,
    status: memorial.status,
    isVerified: memorial.is_verified ?? false,
    viewCount: memorial.view_count ?? 0,
    coverUrl: resolveImageUrl(cover ?? undefined),
    portraitUrl: resolveImageUrl(portrait ?? undefined),
    subtitle,
    dateRange,
    restingPlace,
    announcement: layer.announcement ?? null,
    biography: layer.biography ?? null,
    epitaph: layer.epitaph ?? null,
    guestbookCount: memorial.guestbook_approved_count,
    timelineCount: memorial.timeline_events.length,
    galleryCount: memorial.gallery.length,
    qrCodeUrl: memorial.qr_code_url,
  };
}

function SectionNav({ hasFamilyTree }: { hasFamilyTree: boolean }) {
  const t = useTranslations("memorial");

  const items = [
    { href: "#story", label: t("navStory") },
    { href: "#timeline", label: t("navTimeline") },
    ...(hasFamilyTree ? [{ href: "#family", label: t("navFamily") }] : []),
    { href: "#memories", label: t("navMemories") },
    { href: "#guestbook", label: t("navGuestbook") },
  ];

  return (
    <nav aria-label={t("sectionNavLabel")} className="memorial-section-nav overflow-x-auto">
      <div className="memorial-section-nav-track flex min-w-max gap-2 rounded-full border border-border/80 bg-background/90 p-1 shadow-soft backdrop-blur">
        {items.map((item, index) => (
          <a
            key={item.href}
            href={item.href}
            className="memorial-section-nav-link cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="memorial-stat-card min-w-0 rounded-[1.2rem] border border-border/80 bg-background/80 px-4 py-3 text-center shadow-soft backdrop-blur-sm sm:rounded-[1.5rem] sm:px-5 sm:py-4">
      <p className="truncate text-lg font-semibold text-foreground sm:text-2xl lg:text-3xl">{value}</p>
      <p className="mt-1 truncate text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted sm:text-xs sm:tracking-[0.18em]">{label}</p>
    </div>
  );
}

function StoryCard({ title, body }: { title: string; body: string }) {
  const t = useTranslations("memorial");
  const [expanded, setExpanded] = useState(false);
  const shouldClamp = body.length > 420;

  return (
    <article className="memorial-story-card rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className={["mt-4 text-base leading-8 text-foreground/88 sm:text-[1.05rem]", shouldClamp && !expanded ? "memorial-readable-text is-clamped" : ""].join(" ")}>
        {body}
      </p>
      {shouldClamp ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-4 inline-flex cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          {expanded ? t("showLess") : t("readMore")}
        </button>
      ) : null}
    </article>
  );
}

function GalleryCard({ src, alt, onOpen }: { src: string; alt: string; onOpen?: () => void }) {
  const content = (
    <>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
    </>
  );

  return onOpen ? (
    <button type="button" onClick={onOpen} className="group relative block aspect-[0.86] w-full cursor-pointer overflow-hidden rounded-[1.4rem] border border-border/70 bg-primary/5 text-left shadow-soft sm:rounded-[1.8rem]">
      {content}
    </button>
  ) : (
    <div className="group relative aspect-[0.86] overflow-hidden rounded-[1.4rem] border border-border/70 bg-primary/5 shadow-soft sm:rounded-[1.8rem]">
      {content}
    </div>
  );
}

function GallerySlider({ gallery, title }: { gallery: MediaPublic[]; title: string }) {
  const tCommon = useTranslations("common");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const items = gallery
    .map((item, index) => ({
      id: item.id,
      src: resolveImageUrl(item.original_url ?? item.thumbnail_url ?? undefined),
      alt: item.title ?? `${title} ${index + 1}`,
    }))
    .filter((item): item is { id: string; src: string; alt: string } => Boolean(item.src));

  if (items.length === 0) {
    return null;
  }

  const activeItem = activeIndex == null ? null : items[activeIndex];

  return (
    <>
      <div className="halvaa-swiper-shell">
        <Swiper
          spaceBetween={14}
          slidesOffsetBefore={2}
          slidesOffsetAfter={2}
          breakpoints={{ 0: { slidesPerView: 1.38 }, 640: { slidesPerView: 2.6 }, 1024: { slidesPerView: 3.8 } }}
          className="halvaa-swiper"
        >
          {items.map((item, index) => (
            <SwiperSlide key={item.id}>
              <GalleryCard src={item.src} alt={item.alt} onOpen={() => setActiveIndex(index)} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/82 p-4 backdrop-blur-md" role="dialog" aria-modal="true" onClick={() => setActiveIndex(null)}>
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition hover:bg-white/20 rtl:left-4 rtl:right-auto"
            aria-label={tCommon("close")}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="m6.4 5.34 5.6 5.6 5.6-5.6 1.06 1.06-5.6 5.6 5.6 5.6-1.06 1.06-5.6-5.6-5.6 5.6-1.06-1.06 5.6-5.6-5.6-5.6 1.06-1.06Z" />
            </svg>
          </button>
          <img
            src={activeItem.src}
            alt={activeItem.alt}
            className="max-h-[86vh] max-w-[92vw] rounded-[1.25rem] object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function ShareSheet({ open, onClose, url }: { open: boolean; onClose: () => void; url: string }) {
  const t = useTranslations("memorial");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    void QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: "#111111", light: "#FFFFFF" } }).then((value) => {
      if (!cancelled) setQrDataUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 px-3 pb-3 backdrop-blur-sm sm:px-6 sm:pb-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-[2rem] border border-white/50 bg-white/94 p-5 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{t("shareSheetEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{t("shareSheetTitle")}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:border-primary hover:text-primary" aria-label={t("shareSheetClose")}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="currentColor" d="m6.4 5.34 5.6 5.6 5.6-5.6 1.06 1.06-5.6 5.6 5.6 5.6-1.06 1.06-5.6-5.6-5.6 5.6-1.06-1.06 5.6-5.6-5.6-5.6 1.06-1.06Z" />
            </svg>
          </button>
        </div>
        <div className="mt-5 flex justify-center rounded-[1.5rem] border border-border bg-surface p-4">
          {qrDataUrl ? <img src={qrDataUrl} alt={t("shareSheetQrAlt")} className="h-52 w-52 rounded-xl bg-white object-contain" /> : <div className="h-52 w-52 animate-pulse rounded-xl bg-white" />}
        </div>
        <div className="mt-4 flex min-w-0 items-center gap-2 rounded-full border border-border bg-surface p-2">
          <input value={url} readOnly className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none" aria-label={t("shareSheetUrlLabel")} />
          <button type="button" onClick={copyUrl} className="inline-flex shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BurialWeatherCard({ latitude, longitude }: { latitude: number; longitude: number }) {
  const t = useTranslations("memorial");
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
    });

    fetch(`/api/weather?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("weather");
        return response.json() as Promise<{ current?: { temperature_2m?: number } }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const temperature = payload.current?.temperature_2m;
        if (typeof temperature === "number") {
          setSummary(t("burialWeatherValue", { temperature: Math.round(temperature) }));
        }
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, t]);

  if (!summary) {
    return null;
  }

  return <StatCard value={summary} label={t("burialWeatherLabel")} />;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="memorial-detail-chip rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function openMapUrl(location: MemorialLocation): string | null {
  if (location.latitude == null || location.longitude == null) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function MemorialDetailsSection({ memorial }: { memorial: MemorialProfileData }) {
  const t = useTranslations("memorial");
  const meta = memorial.metadata ?? {};
  const filters = memorial.filter_tags ?? {};
  const detailItems = [
    memorial.category ? { label: t("categoryLabel"), value: memorial.category } : null,
    stringValue(filters.gender) ? { label: t("genderLabel"), value: stringValue(filters.gender)! } : null,
    stringValue(meta.occupation) ? { label: t("occupationLabel"), value: stringValue(meta.occupation)! } : null,
    stringValue(meta.nationality) ? { label: t("nationalityLabel"), value: stringValue(meta.nationality)! } : null,
    stringValue(meta.religion) ? { label: t("religionLabel"), value: stringValue(meta.religion)! } : null,
    stringValue(meta.birth_place) ? { label: t("birthPlaceLabel"), value: stringValue(meta.birth_place)! } : null,
    stringValue(meta.death_place) ? { label: t("deathPlaceLabel"), value: stringValue(meta.death_place)! } : null,
    stringList(meta.languages).length ? { label: t("languagesLabel"), value: stringList(meta.languages).join(", ") } : null,
    stringList(filters.countries).length ? { label: t("countriesLabel"), value: stringList(filters.countries).join(", ") } : null,
    stringList(filters.cities).length ? { label: t("citiesLabel"), value: stringList(filters.cities).join(", ") } : null,
    stringList(meta.places_lived).length ? { label: t("placesLivedLabel"), value: stringList(meta.places_lived).join(", ") } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const tags = stringList(filters.tags);
  const locations = memorial.locations ?? [];

  if (detailItems.length === 0 && tags.length === 0 && locations.length === 0) {
    return null;
  }

  return (
    <div className="memorial-surface memorial-details-surface rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("detailsEyebrow")}</p>
        <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("detailsTitle")}</h2>
      </div>

      {detailItems.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detailItems.map((item) => (
            <DetailChip key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
          ))}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {locations.length > 0 ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {locations.map((location, index) => {
            const mapUrl = openMapUrl(location);
            return (
              <article key={`${location.kind}-${location.label}-${index}`} className="rounded-2xl border border-border bg-surface px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{location.kind || t("locationLabel")}</p>
                    <p className="mt-1 font-medium text-foreground">{location.label || location.address || [location.city, location.country].filter(Boolean).join(", ") || t("locationLabel")}</p>
                    {location.address ? <p className="mt-1 text-sm text-muted">{location.address}</p> : null}
                    {[location.city, location.country].filter(Boolean).length > 0 ? <p className="mt-1 text-sm text-muted">{[location.city, location.country].filter(Boolean).join(", ")}</p> : null}
                    {location.latitude != null && location.longitude != null ? <p className="mt-2 font-mono text-xs text-muted">{location.latitude}, {location.longitude}</p> : null}
                  </div>
                  {mapUrl ? (
                    <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                      {t("openMap")}
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MemorialHero({ model, hasFamilyTree }: { model: MemorialHeaderViewModel; hasFamilyTree: boolean }) {
  const t = useTranslations("memorial");
  const tStatuses = useTranslations("editMemorial.statuses");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const openShareSheet = () => {
    setShareUrl(window.location.href);
    setShareOpen(true);
  };

  return (
    <section className="memorial-profile-hero pb-8">
      <div className="memorial-profile-cover relative h-[310px] overflow-hidden bg-[#efe7dc] sm:h-[360px] lg:h-[420px]">
        {model.coverUrl ? (
          <Image src={model.coverUrl} alt={model.title} fill priority unoptimized={isUploadImageUrl(model.coverUrl)} className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f8f4ee,transparent_40%),linear-gradient(180deg,#f2ebdf_0%,#ddd2c1_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,18,0.08),rgba(18,18,18,0.42))]" />

        <div className="memorial-profile-cover-bar halvaa-container relative flex h-full items-start justify-between py-5">
          <Link
            href="/explore"
            className="memorial-profile-back inline-flex cursor-pointer items-center rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-foreground shadow-soft backdrop-blur transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span aria-hidden="true">←</span>
            {t("backToExplore")}
          </Link>
        </div>
      </div>

      <div className="memorial-profile-identity-wrap halvaa-container -mt-24 space-y-8 ltr:text-left rtl:text-right sm:-mt-28">
        <div className="memorial-profile-identity-card rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft backdrop-blur sm:p-8 lg:p-10">
          <div className="memorial-profile-identity flex flex-col items-center text-center">
            <MemorialImage
              src={model.portraitUrl}
              alt={model.title}
              size={132}
              className="memorial-profile-portrait border-4 border-white shadow-soft"
              fallbackLetter={model.title.charAt(0)}
            />

            <p className="memorial-profile-eyebrow mt-5 text-xs font-semibold uppercase tracking-[0.26em] text-primary">{t("eyebrow")}</p>
            <h1 className="memorial-profile-title mt-3 max-w-3xl text-balance text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              {model.title}
            </h1>
            <MemorialBadge status={model.status} isVerified={model.isVerified} viewCount={model.viewCount} showLabel className="mt-4" />
            {(model.status === "DRAFT" || model.status === "PENDING_APPROVAL") && (
              <p className="mt-4 inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {tStatuses(model.status)}
              </p>
            )}
            {model.subtitle && <p className="memorial-profile-subtitle mt-3 text-base text-muted sm:text-lg">{model.subtitle}</p>}

            <div className="memorial-profile-facts mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted">
              {model.dateRange && (
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
                  {model.dateRange}
                </span>
              )}
              {model.restingPlace && (
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></svg>
                  {model.restingPlace}
                </span>
              )}
            </div>

            <div className="memorial-profile-actions mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={openShareSheet}
                className="memorial-profile-action is-primary inline-flex cursor-pointer items-center rounded-full bg-primary px-5 py-3 font-semibold text-white transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></svg>
                {t("share_link")}
              </button>
              <a
                href="#guestbook"
                className="memorial-profile-action inline-flex cursor-pointer items-center rounded-full border border-border px-5 py-3 font-semibold text-foreground transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S4 16 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 6.5-8 11-8 11Z" /></svg>
                {t("leaveMemory")}
              </a>
            </div>

            <div className="memorial-profile-stats mt-8 grid w-full grid-cols-3 gap-2 sm:gap-3">
              <StatCard value={String(model.guestbookCount)} label={t("statsGuestbook")} />
              <StatCard value={String(model.timelineCount)} label={t("statsTimeline")} />
              <StatCard value={String(model.galleryCount)} label={t("statsMemories")} />
            </div>

            <div className="memorial-profile-reference mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
              <span className="rounded-full border border-border/80 px-3 py-1.5">{t("slugLabel", { slug: model.slug })}</span>
              {model.qrCodeUrl && <span className="rounded-full border border-border/80 px-3 py-1.5">{t("qrAvailable")}</span>}
            </div>
          </div>
        </div>
        <div className="memorial-profile-nav-wrap">
          <SectionNav hasFamilyTree={hasFamilyTree} />
        </div>
      </div>
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} />
    </section>
  );
}

function EmptyState({ title, body, primaryLabel, secondaryLabel }: { title: string; body: string; primaryLabel: string; secondaryLabel: string }) {
  return (
    <section className="py-20">
      <div className="halvaa-container space-y-4 ltr:text-left rtl:text-right">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted">{body}</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="halvaa-btn-primary inline-flex">
            {primaryLabel}
          </Link>
          <Link href="/explore" className="halvaa-btn-secondary inline-flex">
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function MemorialProfile({ slug }: MemorialProfileProps) {
  const t = useTranslations("memorial");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { data: memorial, error, isLoading } = useMemorial(slug);

  useEffect(() => {
    if (!memorial || !["PUBLISHED", "FEATURED"].includes(memorial.status)) return;
    const storageKey = `halvaa:memorial-view:${memorial.id}`;
    const lastRecorded = Number(window.localStorage.getItem(storageKey) ?? "0");
    if (Date.now() - lastRecorded < 24 * 60 * 60 * 1000) return;
    window.localStorage.setItem(storageKey, String(Date.now()));
    void api.recordMemorialView(memorial.id).catch(() => window.localStorage.removeItem(storageKey));
  }, [memorial]);

  if (isLoading) {
    return <SkeletonProfile label={t("loading")} />;
  }

  if (error) {
    if (!isSampleSlug(slug, locale)) {
      if (error instanceof ApiError && error.status === 404) {
        return (
          <EmptyState
            title={t("notFoundTitle")}
            body={t("notFoundBody")}
            primaryLabel={tCommon("backHome")}
            secondaryLabel={t("backToExplore")}
          />
        );
      }

      return (
        <section className="py-20">
          <div className="halvaa-container text-sm text-muted ltr:text-left rtl:text-right">{t("loadError")}</div>
        </section>
      );
    }
  }

  if (!memorial) {
    if (isDemoFallbackEnabled() || isSampleSlug(slug, locale)) {
      const fallbackEvents = getSampleTimeline(slug, locale);
      const fallbackTitle = getSampleNameBySlug(slug, locale) ?? fallbackEvents[0]?.title ?? slug;

      return (
        <MemorialThemeRoot>
          <section className="page-entrance">
            <div className="halvaa-container py-6 space-y-8 ltr:text-left rtl:text-right">
              <div className="rounded-[2rem] border border-border bg-background p-8 shadow-soft text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("eyebrow")}</p>
                <h1 className="mt-3 text-4xl font-semibold text-foreground sm:text-5xl">{fallbackTitle}</h1>
              </div>
              <div id="timeline">
                <h2 className="mb-6 text-2xl font-semibold text-foreground">{t("timelineTitle")}</h2>
                <MemorialTimeline events={fallbackEvents} />
              </div>
              <p className="text-sm text-muted">{t("offlineFallback")}</p>
            </div>
          </section>
        </MemorialThemeRoot>
      );
    }

    return (
      <EmptyState
        title={t("unavailableTitle")}
        body={t("unavailableBody")}
        primaryLabel={tCommon("backHome")}
        secondaryLabel={t("backToExplore")}
      />
    );
  }

  const model = buildHeaderModel(memorial, locale);
  const events = memorialToTimeline(memorial, locale);

  return (
    <MemorialThemeRoot themeOverrides={memorial.theme_overrides}>
      <section className="memorial-profile-page page-entrance pb-16">
        <MemorialHero model={model} hasFamilyTree={memorial.family_tree.length > 0} />

        <div className="memorial-profile-content halvaa-container space-y-8 ltr:text-left rtl:text-right">
          <div id="story" className="memorial-story-grid grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            {model.announcement && <StoryCard title={t("announcementTitle")} body={model.announcement} />}
            {model.biography && <StoryCard title={t("storyTitle")} body={model.biography} />}
            {model.epitaph && <StoryCard title={t("epitaphTitle")} body={model.epitaph} />}
            {!model.biography && !model.epitaph && !model.announcement && (
              <div className="rounded-[2rem] border border-dashed border-border bg-background/90 p-8 text-sm text-muted lg:col-span-2">
                {t("storyEmpty")}
              </div>
            )}
          </div>

          <div className="memorial-contribution-section">
            <ContributionBox memorialId={memorial.id} locale={locale} />
          </div>

          <MemorialDetailsSection memorial={memorial} />

          {(memorial.burial_site_name || memorial.burial_plot_name || memorial.burial_address) && (
            <div className="memorial-surface memorial-burial-surface rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("burialEyebrow")}</p>
                <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("burialTitle")}</h2>
              </div>
              <div className="memorial-burial-grid mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {memorial.burial_site_name ? <StatCard value={memorial.burial_site_name} label={t("burialSiteLabel")} /> : null}
                {memorial.burial_plot_name ? <StatCard value={memorial.burial_plot_name} label={t("burialPlotLabel")} /> : null}
                {memorial.burial_address ? <StatCard value={memorial.burial_address} label={t("burialAddressLabel")} /> : null}
                {memorial.latitude != null && memorial.longitude != null ? <BurialWeatherCard latitude={memorial.latitude} longitude={memorial.longitude} /> : null}
              </div>
            </div>
          )}

          <div id="timeline" className="memorial-content-section memorial-timeline-section space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("navTimeline")}</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("timelineTitle")}</h2>
            </div>
            <MemorialTimeline events={events} />
          </div>

          {memorial.family_tree.length > 0 && (
            <div id="family" className="memorial-surface memorial-family-surface space-y-5 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("familyEyebrow")}</p>
                <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("familyTitle")}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {memorial.family_tree.map((member, index) => (
                  <article key={`${member.name}-${index}`} className="memorial-family-card rounded-[1.5rem] border border-border bg-surface px-5 py-5">
                    <p className="font-medium text-foreground">{member.name}</p>
                    <p className="mt-1 text-sm text-primary">{member.relation}</p>
                    {member.years ? <p className="mt-2 text-xs text-muted">{member.years}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          )}

          <div id="memories" className="memorial-content-section memorial-memories-section space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("navMemories")}</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("galleryTitle")}</h2>
            </div>

            {memorial.gallery.length > 0 ? (
              <GallerySlider gallery={memorial.gallery} title={model.title} />
            ) : (
              <p className="rounded-[2rem] border border-dashed border-border bg-background/90 p-8 text-sm text-muted">
                {t("galleryEmpty")}
              </p>
            )}
          </div>

          {(memorial.documents.length > 0 || model.qrCodeUrl) && (
            <div className="memorial-resource-grid grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              {memorial.documents.length > 0 && (
                <div className="memorial-surface memorial-documents-surface space-y-4 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("documentsEyebrow")}</p>
                    <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("documentsTitle")}</h2>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {memorial.documents.map((item) => (
                      <a key={item.id} href={item.original_url} target="_blank" rel="noreferrer" className="inline-flex min-w-[13rem] flex-1 items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-foreground transition-colors hover:border-primary hover:text-primary">
                        <div className="min-w-0">
                          <p>{item.title ?? (item.category === "WILL" ? t("willLabel") : t("documentLabel"))}</p>
                          {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
                        </div>
                        <span className="shrink-0 text-xs text-muted">{item.mime_type}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {model.qrCodeUrl && (
                <div className="memorial-surface memorial-qr-surface space-y-4 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("qrEyebrow")}</p>
                    <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("qrTitle")}</h2>
                  </div>
                  <p className="text-sm leading-7 text-muted">{t("qrBody")}</p>
                  <div className="flex justify-center rounded-[1.75rem] border border-border bg-surface p-5">
                    <img src={model.qrCodeUrl} alt={t("qrTitle")} className="h-52 w-52 rounded-xl bg-white object-contain p-3" />
                  </div>
                  <a href={model.qrCodeUrl} target="_blank" rel="noreferrer" className="halvaa-btn-secondary inline-flex">{t("qrOpen")}</a>
                </div>
              )}
            </div>
          )}

          {memorial.artifacts.length > 0 && (
            <div className="memorial-surface memorial-artifacts-surface space-y-4 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("artifactsEyebrow")}</p>
                <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("artifactsTitle")}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {memorial.artifacts.map((item, index) => {
                  const src = resolveImageUrl(item.original_url ?? item.thumbnail_url ?? undefined);
                  return (
                    <article key={item.id} className="rounded-[1.75rem] border border-border bg-surface p-4">
                      {src ? <GalleryCard src={src} alt={item.title ?? `${model.title} artifact ${index + 1}`} /> : null}
                      <p className="mt-3 font-medium text-foreground">{item.title ?? t("artifactLabel")}</p>
                      {item.description ? <p className="mt-2 text-sm leading-7 text-muted">{item.description}</p> : null}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          <div id="guestbook" className="memorial-content-section memorial-guestbook-section">
            <GuestbookSection memorialId={memorial.id} />
          </div>
        </div>
      </section>
    </MemorialThemeRoot>
  );
}
