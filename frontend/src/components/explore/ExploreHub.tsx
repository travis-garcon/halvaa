"use client";

import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";

import { useDiscoverMemorials } from "@/hooks/use-discover-memorials";
import { useNearbyMemorials } from "@/hooks/use-nearby-memorials";
import { Link } from "@/i18n/routing";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { gridMemorialsToGeoJson } from "@/lib/explore-data";

import { ExploreWatchGrid } from "./ExploreWatchGrid";
import { MapboxMap } from "./MapboxMap";

type ExploreView = "grid" | "map";
type ExploreFilter = "featured" | "latest" | "updated" | "near_me";

type ExploreHubProps = {
  locale: string;
};

function SkeletonGrid() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-[2rem] border border-border" aria-busy="true" aria-label="Loading explore grid">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <div className="explore-skeleton-grid w-full max-w-sm">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton explore-skeleton-cell" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExploreHub({ locale }: ExploreHubProps) {
  const t = useTranslations("explore");
  const [view, setView] = useState<ExploreView>("grid");
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>("near_me");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const nearby = useNearbyMemorials(locale);
  const featured = useDiscoverMemorials("featured", locale, 18);
  const latest = useDiscoverMemorials("latest", locale, 18);
  const updated = useDiscoverMemorials("updated", locale, 18);

  const source =
    activeFilter === "featured"
      ? featured
      : activeFilter === "latest"
        ? latest
        : activeFilter === "updated"
          ? updated
          : nearby;

  const memorials = source.memorials;
  const collection = activeFilter === "near_me" ? nearby.collection : gridMemorialsToGeoJson(memorials);
  const isLoading = source.isLoading;
  const error = source.error;

  const filteredMemorials = useMemo(() => {
    const results = deferredQuery
      ? memorials.filter((memorial) => memorial.name.toLowerCase().includes(deferredQuery))
      : memorials;

    return [...results].sort((a, b) => (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER));
  }, [deferredQuery, memorials]);

  const filteredCollection = useMemo(() => {
    if (!collection) return collection;
    const allowed = new Set(filteredMemorials.map((memorial) => memorial.slug));
    return {
      ...collection,
      features: collection.features.filter((feature) => allowed.has(feature.properties.slug)),
    };
  }, [collection, filteredMemorials]);
  const showFilterEmpty = deferredQuery.length > 0 && filteredMemorials.length === 0 && memorials.length > 0;
  const plotGroups = useMemo(() => {
    const groups = new Map<string, typeof filteredMemorials>();
    for (const memorial of filteredMemorials) {
      const key = [memorial.burialSiteName, memorial.burialPlotName, memorial.latitude, memorial.longitude].filter(Boolean).join("|");
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), memorial]);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }, [filteredMemorials]);

  return (
    <div className="page-entrance space-y-6">
      <div className="inline-flex rounded-full border border-border bg-background p-1 ltr:flex-row rtl:flex-row-reverse" role="tablist" aria-label={t("viewTabs")}>
        {(["grid", "map"] as ExploreView[]).map((tab) => {
          const active = view === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(tab)}
              className={[
                "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active ? "bg-primary text-white" : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              {tab === "grid" ? t("tabGrid") : t("tabMap")}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["featured", t("filters.featured")],
          ["latest", t("filters.latest")],
          ["updated", t("filters.updated")],
          ["near_me", t("filters.near_me")],
        ] as const).map(([filter, label]) => {
          const active = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={[
                "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active ? "border-primary bg-primary text-white" : "border-border bg-background text-muted hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
          {isDemoFallbackEnabled() ? t("apiFallback") : t("apiError")}
        </p>
      )}

      <div className="rounded-[1.5rem] border border-border bg-background p-3 shadow-soft">
        <label className="sr-only" htmlFor="explore-search">
          {t("search_placeholder")}
        </label>
        <input
          id="explore-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search_placeholder")}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
        />
      </div>

      {showFilterEmpty && (
        <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
          {t("filterEmpty")}
        </p>
      )}

      {isLoading && view === "grid" ? (
        <SkeletonGrid />
      ) : view === "grid" ? (
        <ExploreWatchGrid memorials={filteredMemorials} />
      ) : (
        <MapboxMap collection={filteredCollection} locale={locale} />
      )}

      {plotGroups.length > 0 && (
        <div className="space-y-3 rounded-[2rem] border border-border bg-background p-5 shadow-soft">
          <div>
            <p className="text-sm font-medium text-foreground">{t("plotGroupsTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("plotGroupsHint")}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {plotGroups.map((group) => (
              <div key={group.map((memorial) => memorial.id).join("-")} className="rounded-xl border border-border bg-surface px-4 py-4 text-sm">
                <p className="font-medium text-foreground">{[group[0].burialSiteName, group[0].burialPlotName].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-xs text-muted">{t("plotGroupsCount", { count: group.length })}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.map((memorial) => (
                    <Link key={memorial.id} href={`/memorial/${memorial.slug}`} className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                      {memorial.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
