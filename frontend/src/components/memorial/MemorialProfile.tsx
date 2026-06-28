"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ContributionBox } from "@/components/memorial/ContributionBox";
import { GuestbookSection } from "@/components/memorial/GuestbookSection";
import { MemorialTimeline } from "@/components/memorial/MemorialTimeline";
import { MemorialThemeRoot } from "@/components/MemorialThemeRoot";
import { MemorialImage } from "@/components/ui/MemorialImage";
import { useMemorial } from "@/hooks/use-memorial";
import { Link } from "@/i18n/routing";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { isSampleSlug, getSampleNameBySlug } from "@/lib/explore-data";
import { ApiError } from "@/lib/api-client";
import { resolveImageUrl } from "@/lib/blur";
import { getMemorialDisplayName, memorialToTimeline } from "@/lib/memorial-adapters";
import { getSampleTimeline } from "@/lib/sample-timeline";
import type { MemorialProfile as MemorialProfileData } from "@/types/memorial";

type MemorialProfileProps = {
  slug: string;
};

type MemorialHeaderViewModel = {
  title: string;
  slug: string;
  status: MemorialProfileData["status"];
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

function SkeletonProfile() {
  return (
    <section aria-busy="true" aria-label="Loading memorial profile" className="pb-16">
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

function buildHeaderModel(memorial: MemorialProfileData, locale: string): MemorialHeaderViewModel {
  const layer = getTranslationLayer(memorial, locale);
  const title = getMemorialDisplayName(memorial, locale);
  const cover = memorial.gallery[0]?.original_url ?? memorial.gallery[0]?.thumbnail_url ?? null;
  const portrait = memorial.gallery[1]?.thumbnail_url ?? memorial.gallery[1]?.original_url ?? cover;
  const dateRange = formatDateRange(memorial.birth_date, memorial.death_date, locale);
  const subtitle = layer.occupation ?? layer.subtitle ?? layer.role ?? null;
  const restingPlace = [memorial.burial_site_name, memorial.burial_plot_name, memorial.burial_address].filter(Boolean).join(" · ") || null;

  return {
    title,
    slug: memorial.slug,
    status: memorial.status,
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
    <nav aria-label={t("sectionNavLabel")} className="overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-full border border-border/80 bg-background/90 p-1 shadow-soft backdrop-blur">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border/80 bg-background/80 px-5 py-4 text-center shadow-soft backdrop-blur-sm">
      <p className="text-2xl font-semibold text-foreground sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">{label}</p>
    </div>
  );
}

function StoryCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-4 text-base leading-8 text-foreground/88 sm:text-[1.05rem]">{body}</p>
    </article>
  );
}

function GalleryCard({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="group relative aspect-[0.86] overflow-hidden rounded-[1.8rem] border border-border/70 bg-primary/5 shadow-soft">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
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

function MemorialHero({ model, hasFamilyTree }: { model: MemorialHeaderViewModel; hasFamilyTree: boolean }) {
  const t = useTranslations("memorial");
  const tStatuses = useTranslations("editMemorial.statuses");
  const [copied, setCopied] = useState(false);

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="pb-8">
      <div className="relative h-[310px] overflow-hidden bg-[#efe7dc] sm:h-[360px] lg:h-[420px]">
        {model.coverUrl ? (
          <Image src={model.coverUrl} alt={model.title} fill priority className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f8f4ee,transparent_40%),linear-gradient(180deg,#f2ebdf_0%,#ddd2c1_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,18,18,0.08),rgba(18,18,18,0.42))]" />

        <div className="halvaa-container relative flex h-full items-start justify-between py-5">
          <Link
            href="/explore"
            className="inline-flex cursor-pointer items-center rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-foreground shadow-soft backdrop-blur transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("backToExplore")}
          </Link>
          <SectionNav hasFamilyTree={hasFamilyTree} />
        </div>
      </div>

      <div className="halvaa-container -mt-24 space-y-8 ltr:text-left rtl:text-right sm:-mt-28">
        <div className="rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft backdrop-blur sm:p-8 lg:p-10">
          <div className="flex flex-col items-center text-center">
            <MemorialImage
              src={model.portraitUrl}
              alt={model.title}
              size={132}
              className="border-4 border-white shadow-soft"
              fallbackLetter={model.title.charAt(0)}
            />

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.26em] text-primary">{t("eyebrow")}</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              {model.title}
            </h1>
            {(model.status === "DRAFT" || model.status === "PENDING_APPROVAL") && (
              <p className="mt-4 inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {tStatuses(model.status)}
              </p>
            )}
            {model.subtitle && <p className="mt-3 text-base text-muted sm:text-lg">{model.subtitle}</p>}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted">
              {model.dateRange && <span>{model.dateRange}</span>}
              {model.restingPlace && (
                <>
                  <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-block" aria-hidden />
                  <span>{model.restingPlace}</span>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex cursor-pointer items-center rounded-full bg-primary px-5 py-3 font-semibold text-white transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {copied ? t("copied") : t("share_link")}
              </button>
              <a
                href="#guestbook"
                className="inline-flex cursor-pointer items-center rounded-full border border-border px-5 py-3 font-semibold text-foreground transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t("leaveMemory")}
              </a>
            </div>

            <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
              <StatCard value={String(model.guestbookCount)} label={t("statsGuestbook")} />
              <StatCard value={String(model.timelineCount)} label={t("statsTimeline")} />
              <StatCard value={String(model.galleryCount)} label={t("statsMemories")} />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
              <span className="rounded-full border border-border/80 px-3 py-1.5">{t("slugLabel", { slug: model.slug })}</span>
              {model.qrCodeUrl && <span className="rounded-full border border-border/80 px-3 py-1.5">{t("qrAvailable")}</span>}
            </div>
          </div>
        </div>
      </div>
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

  if (isLoading) {
    return <SkeletonProfile />;
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
      <section className="page-entrance pb-16">
        <MemorialHero model={model} hasFamilyTree={memorial.family_tree.length > 0} />

        <div className="halvaa-container space-y-8 ltr:text-left rtl:text-right">
          <div id="story" className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            {model.announcement && <StoryCard title={t("announcementTitle")} body={model.announcement} />}
            {model.biography && <StoryCard title={t("storyTitle")} body={model.biography} />}
            {model.epitaph && <StoryCard title={t("epitaphTitle")} body={model.epitaph} />}
            {!model.biography && !model.epitaph && !model.announcement && (
              <div className="rounded-[2rem] border border-dashed border-border bg-background/90 p-8 text-sm text-muted lg:col-span-2">
                {t("storyEmpty")}
              </div>
            )}
          </div>

          <ContributionBox memorialId={memorial.id} locale={locale} />

          {(memorial.burial_site_name || memorial.burial_plot_name || memorial.burial_address) && (
            <div className="rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("burialEyebrow")}</p>
                <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("burialTitle")}</h2>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {memorial.burial_site_name ? <StatCard value={memorial.burial_site_name} label={t("burialSiteLabel")} /> : null}
                {memorial.burial_plot_name ? <StatCard value={memorial.burial_plot_name} label={t("burialPlotLabel")} /> : null}
                {memorial.burial_address ? <StatCard value={memorial.burial_address} label={t("burialAddressLabel")} /> : null}
                {memorial.latitude != null && memorial.longitude != null ? <BurialWeatherCard latitude={memorial.latitude} longitude={memorial.longitude} /> : null}
              </div>
            </div>
          )}

          <div id="timeline" className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("navTimeline")}</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("timelineTitle")}</h2>
            </div>
            <MemorialTimeline events={events} />
          </div>

          {memorial.family_tree.length > 0 && (
            <div id="family" className="space-y-5 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("familyEyebrow")}</p>
                <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("familyTitle")}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {memorial.family_tree.map((member, index) => (
                  <article key={`${member.name}-${index}`} className="rounded-[1.5rem] border border-border bg-surface px-5 py-5">
                    <p className="font-medium text-foreground">{member.name}</p>
                    <p className="mt-1 text-sm text-primary">{member.relation}</p>
                    {member.years ? <p className="mt-2 text-xs text-muted">{member.years}</p> : null}
                  </article>
                ))}
              </div>
            </div>
          )}

          <div id="memories" className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("navMemories")}</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("galleryTitle")}</h2>
            </div>

            {memorial.gallery.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {memorial.gallery.map((item, index) => {
                  const src = resolveImageUrl(item.original_url ?? item.thumbnail_url ?? undefined);
                  if (!src) {
                    return null;
                  }

                  return <GalleryCard key={item.id} src={src} alt={`${model.title} ${index + 1}`} />;
                })}
              </div>
            ) : (
              <p className="rounded-[2rem] border border-dashed border-border bg-background/90 p-8 text-sm text-muted">
                {t("galleryEmpty")}
              </p>
            )}
          </div>

          {(memorial.documents.length > 0 || model.qrCodeUrl) && (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              {memorial.documents.length > 0 && (
                <div className="space-y-4 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("documentsEyebrow")}</p>
                    <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("documentsTitle")}</h2>
                  </div>
                  <div className="space-y-3">
                    {memorial.documents.map((item) => (
                      <a key={item.id} href={item.original_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-foreground transition-colors hover:border-primary hover:text-primary">
                        <div>
                          <p>{item.title ?? (item.category === "WILL" ? t("willLabel") : t("documentLabel"))}</p>
                          {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
                        </div>
                        <span className="text-xs text-muted">{item.mime_type}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {model.qrCodeUrl && (
                <div className="space-y-4 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
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
            <div className="space-y-4 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8">
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

          <div id="guestbook">
            <GuestbookSection memorialId={memorial.id} />
          </div>
        </div>
      </section>
    </MemorialThemeRoot>
  );
}
