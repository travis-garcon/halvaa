"use client";

import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useDiscoverMemorials } from "@/hooks/use-discover-memorials";
import { useNearbyMemorials } from "@/hooks/use-nearby-memorials";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { gridMemorialsToGeoJson } from "@/lib/explore-data";

import { ExploreWatchGrid } from "./ExploreWatchGrid";
import { MapboxMap } from "./MapboxMap";

type ExploreView = "grid" | "map";
type ExploreFilter = "featured" | "latest" | "updated" | "near_me";

type ExploreHubProps = {
  locale: string;
};

export function ExploreHub({ locale }: ExploreHubProps) {
  const t = useTranslations("explore");
  const [view, setView] = useState<ExploreView>("grid");
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>("latest");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const nearby = useNearbyMemorials(locale, deferredQuery, 5000, 30);
  const discover = useDiscoverMemorials(activeFilter === "near_me" ? "latest" : activeFilter, locale, deferredQuery, 30);
  const resetDiscoverPages = discover.resetPages;

  useEffect(() => {
    void resetDiscoverPages();
  }, [activeFilter, deferredQuery, resetDiscoverPages]);

  const source = activeFilter === "near_me" ? nearby : discover;
  const memorials = source.memorials;
  const collection = activeFilter === "near_me" ? nearby.collection : gridMemorialsToGeoJson(memorials);
  const error = source.error;

  const filteredMemorials = useMemo(() => {
    if (activeFilter !== "near_me") return memorials;
    return [...memorials].sort((a, b) => (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER));
  }, [activeFilter, memorials]);

  const filteredCollection = useMemo(() => {
    if (!collection) return collection;
    const allowed = new Set(filteredMemorials.map((memorial) => memorial.slug));
    return {
      ...collection,
      features: collection.features.filter((feature) => allowed.has(feature.properties.slug)),
    };
  }, [collection, filteredMemorials]);

  return (
    <section className="explore-shell" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="explore-shell-canvas" />

      <div className="explore-shell-topbar">
        <div className="explore-shell-search-wrap">
          <label className="sr-only" htmlFor="explore-search">{t("search_placeholder")}</label>
          <div className="explore-shell-search-card">
            <span className="explore-shell-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
            </span>
            <input
              id="explore-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search_placeholder")}
              className="explore-shell-search-input"
              dir="auto"
            />
          </div>
          <div className="explore-shell-filter-row">
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
                  className={active ? "is-active" : ""}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="explore-shell-stage">
        {error && (
          <p className="explore-shell-banner">
            {isDemoFallbackEnabled() ? t("apiFallback") : t("apiError")}
          </p>
        )}

        {view === "grid" ? <ExploreWatchGrid memorials={filteredMemorials} /> : <MapboxMap collection={filteredCollection} locale={locale} className="explore-full-map" />}
        {activeFilter !== "near_me" && discover.hasMore ? (
          <button type="button" onClick={() => void discover.loadMore()} className="explore-shell-load-more">
            {t("loadMore")}
          </button>
        ) : null}
      </div>

      <div className="explore-shell-bottombar">
        <div className="explore-shell-view-switch" role="tablist" aria-label={t("viewTabs")}>
          {([
            ["grid", t("tabGrid")],
            ["map", t("tabMap")],
          ] as const).map(([tab, label]) => {
            const active = view === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(tab)}
                className={active ? "is-active" : ""}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
