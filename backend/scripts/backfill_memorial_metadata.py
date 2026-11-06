"""Backfill existing memorial language layers and metadata without deleting rows.

Run inside the backend container:
    python -m scripts.backfill_memorial_metadata
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.core.database import engine
from app.models.memorial import Memorial

LOCALES = ("en", "fa", "ar", "zh")

CATEGORY_KEYWORDS = (
    ("science", ("mathematician", "physicist", "science", "computer", "geometry", "technology")),
    ("literature", ("poet", "novelist", "literature", "writer", "fiction", "prose")),
    ("public-service", ("president", "diplomat", "statesman", "political", "leader")),
    ("arts", ("artist", "cinema", "director", "film", "painting", "sculpture")),
    ("humanitarian", ("humanitarian", "charity", "service", "nonviolent", "peace")),
    ("technology", ("computing", "software", "product design", "innovation")),
)

COUNTRY_HINTS = {
    "Iran": ("iran", "iranian", "tehran"),
    "United States": ("united-states", "american", None),
    "England": ("united-kingdom", "british", "london"),
    "Ghana": ("ghana", "ghanaian", "accra"),
    "India": ("india", "indian", "new-delhi"),
    "South Africa": ("south-africa", "south-african", "qunu"),
    "France": ("france", "french", None),
    "Colombia": ("colombia", "colombian", "cartagena"),
}


def first_translation_layer(translations: dict) -> dict:
    for locale in LOCALES:
        layer = translations.get(locale)
        if isinstance(layer, dict) and layer.get("name"):
            return layer
    for layer in translations.values():
        if isinstance(layer, dict) and layer.get("name"):
            return layer
    return {}


def infer_category(layer: dict) -> str:
    haystack = " ".join(str(layer.get(field, "")) for field in ("name", "biography", "epitaph")).lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in haystack for keyword in keywords):
            return category
    return "public-memory"


def infer_location(memorial: Memorial) -> tuple[str | None, str | None, str | None, list[str]]:
    location = " ".join(
        value
        for value in (memorial.burial_address, memorial.burial_site_name, memorial.burial_plot_name)
        if value
    )
    for label, (country, nationality, city) in COUNTRY_HINTS.items():
        if label.lower() in location.lower():
            return country, nationality, city, [location] if location else []
    return None, None, None, [location] if location else []


def backfill() -> None:
    updated = 0
    with Session(engine) as session:
        memorials = session.exec(select(Memorial)).all()
        for memorial in memorials:
            changed = False
            translations = dict(memorial.translations or {})
            source_layer = first_translation_layer(translations)
            if source_layer:
                for locale in LOCALES:
                    layer = translations.get(locale)
                    if not isinstance(layer, dict) or not layer.get("name"):
                        translations[locale] = dict(source_layer)
                        changed = True
                if changed:
                    memorial.translations = translations

            category = memorial.category or infer_category(source_layer)
            country, nationality, city, places = infer_location(memorial)
            if not memorial.category:
                memorial.category = category
                changed = True

            if not memorial.meta:
                memorial.meta = {
                    "category": category,
                    "gender": None,
                    "nationality": nationality,
                    "country": country,
                    "city": city,
                    "places_lived": places,
                    "family_history": f"Family history details for {source_layer.get('name', memorial.slug)} can be expanded by relatives and verified contributors.",
                    "childhood": f"Childhood and early-life details for {source_layer.get('name', memorial.slug)} can be added by owners and contributors.",
                    "source": "metadata-backfill",
                }
                changed = True

            if not memorial.filter_tags:
                tags = {category}
                biography = str(source_layer.get("biography", "")).lower()
                for tag in ("science", "literature", "art", "politics", "humanitarian", "technology", "iran", "women"):
                    if tag in biography:
                        tags.add(tag)
                memorial.filter_tags = {
                    "category": category,
                    "gender": memorial.meta.get("gender") if isinstance(memorial.meta, dict) else None,
                    "nationality": nationality,
                    "country": country,
                    "city": city,
                    "tags": sorted(tag for tag in tags if tag),
                    "places_lived": places,
                    "family_history": True,
                    "childhood": True,
                }
                changed = True

            if changed:
                session.add(memorial)
                updated += 1

        session.commit()
    print(f"Backfilled {updated} memorials.")


if __name__ == "__main__":
    backfill()
