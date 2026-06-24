import type { GridMemorial } from "@/types/memorial";
import type { GeoJSONFeatureCollection } from "@/types/memorial";

const SAMPLE_EN: GridMemorial[] = [
  { id: "1", slug: "margaret-thompson", name: "Margaret Thompson" },
  { id: "2", slug: "robert-mitchell", name: "Robert Mitchell" },
  { id: "3", slug: "elena-rodriguez", name: "Elena Rodriguez" },
  { id: "4", slug: "david-chen", name: "David Chen" },
  { id: "5", slug: "sarah-williams", name: "Sarah Williams" },
  { id: "6", slug: "thomas-brown", name: "Thomas Brown" },
  { id: "7", slug: "yuki-nakamura", name: "Yuki Nakamura" },
  { id: "8", slug: "amira-hassan", name: "Amira Hassan" },
  { id: "9", slug: "james-wilson", name: "James Wilson" },
  { id: "10", slug: "lucia-ferrari", name: "Lucia Ferrari" },
  { id: "11", slug: "omar-khalil", name: "Omar Khalil" },
  { id: "12", slug: "nina-petrov", name: "Nina Petrov" },
];

const SAMPLE_FA: GridMemorial[] = [
  { id: "1", slug: "ferdowsi", name: "فردوسی" },
  { id: "2", slug: "parvin-etesami", name: "پروین اعتصامی" },
  { id: "3", slug: "jalal-ale-ahmad", name: "جلال آل‌احمد" },
  { id: "4", slug: "simin-daneshvar", name: "سیمین دانشور" },
  { id: "5", slug: "sohrab-sepehri", name: "سهراب سپهری" },
  { id: "6", slug: "forough-farrokhzad", name: "فروغ فرخزاد" },
  { id: "7", slug: "ahmad-shamlou", name: "احمد شاملو" },
  { id: "8", slug: "nader-ebrahimi", name: "نادر ابراهیمی" },
  { id: "9", slug: "mahmoud-dolat-abadi", name: "محمود دولت‌آبادی" },
  { id: "10", slug: "houshang-golshiri", name: "هوشنگ گلشیری" },
  { id: "11", slug: "gholam-hossein-saedi", name: "غلامحسین ساعدی" },
  { id: "12", slug: "sadegh-hedayat", name: "صادق هدایت" },
];

export function getSampleGridMemorials(locale: string): GridMemorial[] {
  return locale === "fa" ? SAMPLE_FA : SAMPLE_EN;
}

export function isSampleSlug(slug: string, locale: string): boolean {
  const samples = getSampleGridMemorials(locale);
  return samples.some((s) => s.slug === slug);
}

export function getSampleNameBySlug(slug: string, locale: string): string | null {
  const samples = getSampleGridMemorials(locale);
  return samples.find((s) => s.slug === slug)?.name ?? null;
}

export function geoJsonToGridMemorials(
  collection: GeoJSONFeatureCollection,
): GridMemorial[] {
  if (!collection.features.length) {
    return [];
  }

  return collection.features.map((feature) => ({
    id: feature.properties.id,
    slug: feature.properties.slug,
    name: feature.properties.name ?? feature.properties.slug,
    burialSiteName: feature.properties.burial_site_name,
    burialPlotName: feature.properties.burial_plot_name,
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    distanceM: feature.properties.distance_m,
  }));
}

export function gridMemorialsToGeoJson(memorials: GridMemorial[]): GeoJSONFeatureCollection {
  return {
    type: "FeatureCollection",
    features: memorials
      .filter((memorial) => memorial.latitude != null && memorial.longitude != null)
      .map((memorial) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [memorial.longitude as number, memorial.latitude as number] as [number, number],
        },
        properties: {
          id: memorial.id,
          slug: memorial.slug,
          name: memorial.name,
          distance_m: memorial.distanceM ?? 0,
          burial_site_name: memorial.burialSiteName ?? null,
          burial_plot_name: memorial.burialPlotName ?? null,
        },
      })),
  };
}
