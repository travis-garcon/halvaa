import type { FamilyMember, MemorialLocation } from "@/types/memorial";

export type MemorialDetailsFormState = {
  fullName: string;
  biography: string;
  epitaph: string;
  announcement: string;
  birthDate: string;
  deathDate: string;
  burialAddress: string;
  burialSiteName: string;
  burialPlotName: string;
  qrCodeUrl: string;
  category: string;
  gender: string;
  occupation: string;
  nationality: string;
  religion: string;
  languages: string;
  countries: string;
  cities: string;
  birthPlace: string;
  deathPlace: string;
  placesLived: string;
  tags: string;
  latitude: string;
  longitude: string;
  familyTree: FamilyMember[];
  locations: MemorialLocation[];
};

export const DEFAULT_MEMORIAL_FORM_STATE: MemorialDetailsFormState = {
  fullName: "",
  biography: "",
  epitaph: "",
  announcement: "",
  birthDate: "",
  deathDate: "",
  burialAddress: "",
  burialSiteName: "",
  burialPlotName: "",
  qrCodeUrl: "",
  category: "",
  gender: "",
  occupation: "",
  nationality: "",
  religion: "",
  languages: "",
  countries: "",
  cities: "",
  birthPlace: "",
  deathPlace: "",
  placesLived: "",
  tags: "",
  latitude: "",
  longitude: "",
  familyTree: [],
  locations: [],
};

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinList(value: unknown): string {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join(", ") : "";
}

export function numberOrNull(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export function buildMemorialDetailsPayload(state: MemorialDetailsFormState, locale: string, existingTranslations: Record<string, Record<string, string>> = {}) {
  const metadata = {
    birth_place: state.birthPlace.trim() || null,
    death_place: state.deathPlace.trim() || null,
    occupation: state.occupation.trim() || null,
    nationality: state.nationality.trim() || null,
    religion: state.religion.trim() || null,
    languages: splitList(state.languages),
    places_lived: splitList(state.placesLived),
  };
  const filterTags = {
    gender: state.gender.trim() || null,
    countries: splitList(state.countries),
    cities: splitList(state.cities),
    tags: splitList(state.tags),
  };

  return {
    birth_date: state.birthDate || null,
    death_date: state.deathDate || null,
    burial_address: state.burialAddress.trim() || null,
    burial_site_name: state.burialSiteName.trim() || null,
    burial_plot_name: state.burialPlotName.trim() || null,
    qr_code_url: state.qrCodeUrl.trim() || null,
    category: state.category.trim() || null,
    metadata,
    translation_status: {
      source_locale: locale,
      requested_locales: ["en", "fa", "ar", "zh"].filter((targetLocale) => targetLocale !== locale),
      status: "queued",
      provider: "pending-free-translation-api",
    },
    filter_tags: filterTags,
    locations: state.locations.filter((location) => location.kind || location.label || location.address || location.latitude || location.longitude),
    family_tree: state.familyTree.filter((member) => member.name.trim() && member.relation.trim()),
    latitude: numberOrNull(state.latitude),
    longitude: numberOrNull(state.longitude),
    translations: {
      ...existingTranslations,
      [locale]: {
        name: state.fullName.trim(),
        ...(state.biography.trim() ? { biography: state.biography.trim() } : {}),
        ...(state.epitaph.trim() ? { epitaph: state.epitaph.trim() } : {}),
        ...(state.announcement.trim() ? { announcement: state.announcement.trim() } : {}),
      },
    },
  };
}
