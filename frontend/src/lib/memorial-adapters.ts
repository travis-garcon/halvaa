import { geoJsonToGridMemorials, getSampleGridMemorials } from "@/lib/explore-data";
import { isDemoFallbackEnabled } from "@/lib/demo-mode";
import { isMemorialLocallyDeleted } from "@/lib/explore-cache";
import type {
  ExploreMemorialFeed,
  GeoJSONFeatureCollection,
  GridMemorial,
  MemorialProfile,
  MemorialPublic,
  TimelineEvent,
} from "@/types/memorial";

export function getMemorialDisplayName(
  memorial: MemorialPublic | MemorialProfile,
  locale: string,
): string {
  const layer =
    memorial.translations[locale] ??
    memorial.translations.en ??
    Object.values(memorial.translations)[0];

  return layer?.name ?? memorial.slug;
}

export function memorialToTimeline(
  memorial: MemorialPublic | MemorialProfile,
  locale: string,
): TimelineEvent[] {
  if ("timeline_events" in memorial && memorial.timeline_events.length > 0) {
    return memorial.timeline_events.map((event) => {
      const layer =
        event.translations[locale] ??
        event.translations.en ??
        Object.values(event.translations)[0] ??
        {};
      return {
        id: event.id,
        eventType: event.event_type,
        eventDate: event.event_date ?? undefined,
        title: layer.title ?? layer.name ?? memorial.slug,
        body: layer.body ?? layer.description,
        location: layer.location,
        thumbnailUrl: event.thumbnail_url ?? undefined,
      };
    });
  }

  const layer =
    memorial.translations[locale] ??
    memorial.translations.en ??
    Object.values(memorial.translations)[0] ??
    {};

  const events: TimelineEvent[] = [];

  if (layer.biography) {
    events.push({
      id: `${memorial.id}-bio`,
      eventType: "BIOGRAPHY",
      title: layer.name ?? memorial.slug,
      body: layer.biography,
    });
  }

  if (memorial.birth_date) {
    events.push({
      id: `${memorial.id}-birth`,
      eventType: "LIFE_EVENT",
      eventDate: memorial.birth_date,
      title: locale === "fa" ? "تولد" : "Birth",
      body: layer.birthPlace,
    });
  }

  if (memorial.death_date) {
    events.push({
      id: `${memorial.id}-death`,
      eventType: "LIFE_EVENT",
      eventDate: memorial.death_date,
      title: locale === "fa" ? "درگذشت" : "Passing",
      body: layer.epitaph,
    });
  }

  if (memorial.burial_address || memorial.latitude) {
    events.push({
      id: `${memorial.id}-burial`,
      eventType: "LOCATION",
      eventDate: memorial.death_date ?? undefined,
      title: locale === "fa" ? "محل دفن" : "Resting place",
      location: memorial.burial_address ?? undefined,
    });
  }

  return events;
}

export function resolveGridMemorials(
  collection: GeoJSONFeatureCollection | undefined,
  locale: string,
): GridMemorial[] {
  const fromApi = collection ? geoJsonToGridMemorials(collection).filter((item) => !isMemorialLocallyDeleted(item.id)) : [];
  if (fromApi.length) {
    return fromApi;
  }
  return isDemoFallbackEnabled() ? getSampleGridMemorials(locale) : [];
}

export function resolveDiscoveryMemorials(
  feed: ExploreMemorialFeed | undefined,
  locale: string,
): GridMemorial[] {
  if (feed?.items.length) {
    return feed.items.filter((item) => !isMemorialLocallyDeleted(item.id)).map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
        status: item.status,
        burialAddress: item.burial_address,
        burialSiteName: item.burial_site_name,
        burialPlotName: item.burial_plot_name,
        category: item.category,
        metadata: item.metadata,
        filterTags: item.filter_tags,
        latitude: item.latitude,
      longitude: item.longitude,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      publishedAt: item.published_at,
      featuredAt: item.featured_at,
      isVerified: item.is_verified,
      viewCount: item.view_count,
      imageUrl: item.image_url ?? undefined,
    }));
  }

  return isDemoFallbackEnabled() ? getSampleGridMemorials(locale) : [];
}
