"""Replace admin-created memorials with records backed by frontend public images.

Run from `backend/`:
    python -m scripts.import_public_memorials
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timezone
import os
from pathlib import Path
import unicodedata

from sqlmodel import Session, delete, select

from app.core.auth import hash_password
from app.core.database import engine
from app.models.collaborator import MemorialCollaborator
from app.models.contribution import MemorialContribution
from app.models.enums import (
    CollaboratorRole,
    MediaCategory,
    MediaProcessingStatus,
    MediaType,
    MemorialStatus,
    TimelineEventType,
    UserRole,
)
from app.models.guestbook import GuestbookEntry
from app.models.media import MediaAsset
from app.models.memorial import Memorial
from app.models.review_event import ReviewEvent
from app.models.store import LandingMemorialPlacement, Purchase
from app.models.timeline import TimelineEvent
from app.models.user import User
from app.services.geo import point_from_lat_lng

ADMIN_USER_EMAILS = (
    "myformbox@gmail.com",
    "dev@example.com",
)
DEV_USER_PASSWORD = "devpassword123"

IMAGE_DIR = Path(
    os.environ.get(
        "HALVAA_PUBLIC_IMAGE_DIR",
        str(Path(__file__).resolve().parents[2] / "frontend" / "public" / "images"),
    )
)
BASE_LAT = 35.6892
BASE_LNG = 51.3890

COUNTRY_HINTS = {
    "Iran": ("iran", "iranian", "Tehran"),
    "United States": ("united-states", "american", "California"),
    "England": ("united-kingdom", "british", "London"),
    "Ghana": ("ghana", "ghanaian", "Accra"),
    "India": ("india", "indian", "New Delhi"),
    "South Africa": ("south-africa", "south-african", "Qunu"),
    "France": ("france", "french", "Mougins"),
    "Colombia": ("colombia", "colombian", "Cartagena"),
}

CATEGORY_KEYWORDS = (
    ("science", ("mathematician", "physicist", "science", "computer", "computation", "geometry")),
    ("literature", ("poet", "novelist", "literature", "writer", "fiction", "prose")),
    ("public-service", ("president", "diplomat", "statesman", "secretary-general", "political")),
    ("arts", ("artist", "cinema", "director", "film", "painting", "sculpture")),
    ("humanitarian", ("humanitarian", "charity", "service", "nonviolent", "peace")),
    ("technology", ("technology", "computing", "software", "product design")),
)


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value


def normalize_person_key(filename: str) -> str:
    stem = Path(filename).name
    stem = re.sub(r"(?i)\.(jpe?g|png)$", "", stem)
    stem = re.sub(r"(?i)jpe?g$", "", stem)
    stem = stem.replace(".", " ")
    stem = re.sub(r"[_,-]+", " ", stem)
    stem = re.sub(r"(?i)\bmain\b", "", stem)
    stem = re.sub(r"(?i)\bcc0[a-z0-9]*\b", "", stem)
    stem = re.sub(r"(?<=[A-Za-z])\d+\b", "", stem)
    stem = re.sub(r"\b\d+\b", "", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem.lower()


def title_from_key(key: str) -> str:
    parts = [part for part in key.split() if part]
    return " ".join(word.capitalize() for word in parts)


def is_main_image(filename: str) -> bool:
    return "main" in Path(filename).stem.lower()


def make_biography(name: str, legacy: str, vocation: str, achievements: list[str], legacy_impact: str) -> str:
    achievements_text = " ".join(achievements)
    return (
        f"{name} is remembered as {legacy}. "
        f"{vocation} {achievements_text} "
        f"{legacy_impact} "
        f"This memorial brings together a fuller public record of their life, work, influence, and the human qualities for which they continue to be admired. "
        f"It invites visitors to reflect on both the historical importance of {name} and the more personal dimensions of a life shaped by discipline, imagination, service, and conviction."
    )


def infer_category(spec: dict[str, object]) -> str:
    haystack = " ".join(str(spec.get(field, "")) for field in ("name", "biography", "epitaph")).lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in haystack for keyword in keywords):
            return category
    return "public-memory"


def infer_location_tags(spec: dict[str, object]) -> tuple[str | None, str | None, str | None, list[str]]:
    location = " ".join(str(spec.get(field, "")) for field in ("burial_address", "burial_site_name")).strip()
    for label, (country_slug, nationality, default_city) in COUNTRY_HINTS.items():
        if label.lower() in location.lower():
            city = location.split(",", 1)[0].strip() or default_city
            return country_slug, nationality, slugify(city), [location]
    return None, None, None, [location] if location else []


def build_memorial_metadata(spec: dict[str, object]) -> tuple[str, dict[str, object], dict[str, object]]:
    category = infer_category(spec)
    country, nationality, city, places = infer_location_tags(spec)
    biography = str(spec.get("biography", ""))
    tags = sorted({
        category,
        *(word for word in ("science", "literature", "art", "politics", "humanitarian", "technology", "iran", "women") if word in biography.lower()),
    })
    metadata = {
        "category": category,
        "gender": spec.get("gender"),
        "nationality": spec.get("nationality") or nationality,
        "country": country,
        "city": city,
        "places_lived": places,
        "family_history": spec.get("family_history") or f"Family history details for {spec.get('name')} can be expanded by relatives and verified contributors.",
        "childhood": spec.get("childhood") or f"Childhood and early-life details for {spec.get('name')} are prepared as a dedicated timeline area for future enrichment.",
        "source": "public-image-import",
    }
    filter_tags = {
        "category": category,
        "gender": spec.get("gender"),
        "nationality": spec.get("nationality") or nationality,
        "country": country,
        "city": city,
        "tags": [tag for tag in tags if tag],
        "places_lived": places,
        "family_history": bool(metadata["family_history"]),
        "childhood": bool(metadata["childhood"]),
    }
    return category, metadata, filter_tags


def timeline_translations(title: str, body: str) -> dict[str, dict[str, str]]:
    return {
        locale: {"title": title, "body": body}
        for locale in ("en", "fa", "ar", "zh")
    }


MEMORIAL_SPECS = {
    "alan turing age colorized": {
        "name": "Alan Turing",
        "birth_date": date(1912, 6, 23),
        "death_date": date(1954, 6, 7),
        "burial_address": "London, England (memorial record)",
        "burial_site_name": "London memorial archive",
        "burial_plot_name": "Digital remembrance collection",
        "offset": (0.001, 0.001),
        "epitaph": "He imagined the logic of a new world.",
        "biography": make_biography(
            "Alan Turing",
            "one of the foundational thinkers of computer science and modern cryptanalysis",
            "A mathematician, logician, and codebreaker, he helped define how machines could reason through symbolic processes.",
            [
                "His wartime work at Bletchley Park contributed to Allied codebreaking efforts during the Second World War.",
                "His theoretical writing on computation reshaped mathematics, engineering, and philosophy for generations.",
            ],
            "His legacy lives on wherever computing, artificial intelligence, and rigorous scientific imagination meet.",
        ),
    },
    "ernest hemingway": {
        "name": "Ernest Hemingway",
        "birth_date": date(1899, 7, 21),
        "death_date": date(1961, 7, 2),
        "burial_address": "Ketchum, Idaho, United States",
        "burial_site_name": "Ketchum Memorial Site",
        "burial_plot_name": "Literary remembrance",
        "offset": (0.002, 0.003),
        "epitaph": "His sentences carried courage, loss, and weathered grace.",
        "biography": make_biography(
            "Ernest Hemingway",
            "a defining voice of twentieth-century literature",
            "A novelist, reporter, and stylist of remarkable precision, he wrote about war, love, travel, endurance, and moral pressure with a prose style that influenced writers across the world.",
            [
                "His major works captured both the visible drama and the emotional undercurrents of modern life.",
                "He received the Nobel Prize in Literature and remains central to discussions of craft, masculinity, witness, and narrative economy.",
            ],
            "His body of work continues to shape literary study and popular reading alike.",
        ),
    },
    "forough farrokhzad": {
        "name": "Forough Farrokhzad",
        "birth_date": date(1934, 1, 5),
        "death_date": date(1967, 2, 13),
        "burial_address": "Tehran, Iran",
        "burial_site_name": "Zahir-od-Dowleh Cemetery",
        "burial_plot_name": "Poets and artists section",
        "offset": (0.003, -0.002),
        "epitaph": "She gave modern feeling a fearless Persian voice.",
        "biography": make_biography(
            "Forough Farrokhzad",
            "one of the most influential modern poets in Persian literature",
            "A poet, filmmaker, and bold cultural figure, she transformed the language of lyric expression through intimacy, vulnerability, critique, and formal freshness.",
            [
                "Her poems opened new possibilities for how interior life, womanhood, loneliness, desire, and social expectation could be written.",
                "Her artistic work continues to inspire readers, filmmakers, scholars, and poets throughout Iran and beyond.",
            ],
            "Her voice remains urgent because it is at once deeply personal and unmistakably historical.",
        ),
    },
    "gabriel garcia marquez": {
        "name": "Gabriel García Márquez",
        "birth_date": date(1927, 3, 6),
        "death_date": date(2014, 4, 17),
        "burial_address": "Cartagena, Colombia (memorial record)",
        "burial_site_name": "Cartagena memorial archive",
        "burial_plot_name": "Literary remembrance",
        "offset": (0.004, 0.004),
        "epitaph": "He turned memory into a universe.",
        "biography": make_biography(
            "Gabriel García Márquez",
            "a towering novelist and journalist whose imagination altered world literature",
            "He brought together political history, family saga, myth, tenderness, and irony in a narrative mode that came to define magical realism for many readers.",
            [
                "His fiction illuminated the emotional and historical complexity of Latin America while reaching a universal audience.",
                "Awarded the Nobel Prize in Literature, he remains a central figure in conversations about narrative scale, memory, and storytelling itself.",
            ],
            "His works continue to inspire readers to see time, place, and human longing through a richer lens.",
        ),
    },
    "hitchcock alfred": {
        "name": "Alfred Hitchcock",
        "birth_date": date(1899, 8, 13),
        "death_date": date(1980, 4, 29),
        "burial_address": "Los Angeles, California, United States (memorial record)",
        "burial_site_name": "Los Angeles memorial archive",
        "burial_plot_name": "Cinema remembrance",
        "offset": (0.005, -0.004),
        "epitaph": "He taught suspense how to breathe.",
        "biography": make_biography(
            "Alfred Hitchcock",
            "one of cinema’s most formative directors and masters of suspense",
            "Across decades of filmmaking, he developed visual storytelling techniques that heightened tension, sharpened psychological complexity, and made viewers active participants in dramatic uncertainty.",
            [
                "His films transformed the thriller genre and influenced generations of directors, critics, actors, and audiences.",
                "He remains a vital reference point in the study of editing, point of view, suspense, and screen authorship.",
            ],
            "His work endures because it still feels technically brilliant and emotionally immediate.",
        ),
    },
    "john f kennedy": {
        "name": "John F. Kennedy",
        "birth_date": date(1917, 5, 29),
        "death_date": date(1963, 11, 22),
        "burial_address": "Arlington, Virginia, United States",
        "burial_site_name": "Arlington National Cemetery",
        "burial_plot_name": "Presidential gravesite",
        "offset": (0.006, 0.002),
        "epitaph": "He called a generation to public purpose.",
        "biography": make_biography(
            "John F. Kennedy",
            "the thirty-fifth president of the United States and an enduring political symbol of civic aspiration",
            "His public life was marked by wartime service, congressional and senatorial leadership, and a presidency that confronted Cold War pressures while articulating a forward-looking vision of citizenship and achievement.",
            [
                "His speeches on service, freedom, and collective responsibility continue to be quoted across political and educational settings.",
                "His presidency remains a subject of deep historical study because of its global stakes, unfinished ambitions, and lasting cultural resonance.",
            ],
            "He is remembered as both a statesman and an emblem of possibility cut short.",
        ),
    },
    "kofi annan": {
        "name": "Kofi Annan",
        "birth_date": date(1938, 4, 8),
        "death_date": date(2018, 8, 18),
        "burial_address": "Accra, Ghana",
        "burial_site_name": "Military Cemetery, Accra",
        "burial_plot_name": "Public service remembrance",
        "offset": (0.007, -0.003),
        "epitaph": "He practiced diplomacy as a form of conscience.",
        "biography": make_biography(
            "Kofi Annan",
            "a global diplomat whose career embodied international cooperation and principled public service",
            "As Secretary-General of the United Nations, he championed peace, development, human dignity, and institutional reform during a period of major global transitions.",
            [
                "His leadership and advocacy helped advance humanitarian responsibility and multilateral engagement.",
                "He shared the Nobel Peace Prize with the United Nations and remained an influential moral voice in international affairs after leaving office.",
            ],
            "He is remembered for combining calm authority with a deep commitment to human worth.",
        ),
    },
    "mahatma gandhi studio": {
        "name": "Mahatma Gandhi",
        "birth_date": date(1869, 10, 2),
        "death_date": date(1948, 1, 30),
        "burial_address": "Raj Ghat, New Delhi, India",
        "burial_site_name": "Raj Ghat",
        "burial_plot_name": "National memorial",
        "offset": (0.008, 0.005),
        "epitaph": "He made moral courage a public force.",
        "biography": make_biography(
            "Mahatma Gandhi",
            "a leader whose philosophy of nonviolent resistance transformed political struggle in the modern world",
            "Through disciplined activism, ethical conviction, and mass mobilization, he helped shape India’s independence movement and influenced civil rights campaigns across continents.",
            [
                "His thought on truth, self-rule, conscience, and nonviolence continues to be studied by historians, activists, and political thinkers.",
                "His life remains a touchstone for debates about justice, sacrifice, spirituality, and public responsibility.",
            ],
            "He is remembered as one of the central moral and political figures of the twentieth century.",
        ),
    },
    "mahmoud hesabi": {
        "name": "Mahmoud Hesabi",
        "birth_date": date(1903, 2, 23),
        "death_date": date(1992, 9, 3),
        "burial_address": "Tajrish, Tehran, Iran (memorial record)",
        "burial_site_name": "Iranian scientific remembrance",
        "burial_plot_name": "National figures archive",
        "offset": (0.009, -0.005),
        "epitaph": "He helped build the language of science in modern Iran.",
        "biography": make_biography(
            "Mahmoud Hesabi",
            "a physicist, educator, and institution-builder associated with the development of modern science in Iran",
            "He contributed not only through teaching and research, but also through helping establish educational and scientific foundations that served later generations.",
            [
                "He is widely remembered for encouraging scientific learning, intellectual rigor, and public respect for knowledge.",
                "His legacy remains especially meaningful in discussions of national scientific development and educational modernization.",
            ],
            "He is honored as a figure of learning, discipline, and cultural service.",
        ),
    },
    "maryam mirzakhani": {
        "name": "Maryam Mirzakhani",
        "birth_date": date(1977, 5, 12),
        "death_date": date(2017, 7, 14),
        "burial_address": "California, United States",
        "burial_site_name": "Stanford memorial record",
        "burial_plot_name": "Mathematics remembrance",
        "offset": (0.010, 0.006),
        "epitaph": "She revealed wonder in the curves of thought.",
        "biography": make_biography(
            "Maryam Mirzakhani",
            "a mathematician whose originality and depth changed the landscape of modern geometry",
            "Her research in hyperbolic geometry, moduli spaces, and dynamical systems earned admiration for both its power and elegance.",
            [
                "She became the first woman to receive the Fields Medal, opening a historic chapter in the public story of mathematics.",
                "Her work continues to inspire students, researchers, and all those who see intellectual beauty as a human achievement worth celebrating.",
            ],
            "She is remembered with pride, affection, and enduring scientific respect.",
        ),
    },
    "motherteresa": {
        "name": "Mother Teresa",
        "birth_date": date(1910, 8, 26),
        "death_date": date(1997, 9, 5),
        "burial_address": "Kolkata, India",
        "burial_site_name": "Mother House",
        "burial_plot_name": "Missionaries of Charity memorial",
        "offset": (0.011, -0.006),
        "epitaph": "She answered suffering with presence.",
        "biography": make_biography(
            "Mother Teresa",
            "a religious sister and humanitarian known throughout the world for her life of service",
            "She founded the Missionaries of Charity and devoted decades to caring for the poor, the sick, the dying, and the abandoned.",
            [
                "Her work inspired broad admiration and sustained reflection on charity, dignity, vocation, and the ethics of compassion.",
                "She remains a globally recognized figure whose life continues to evoke gratitude, debate, reverence, and service.",
            ],
            "She is remembered for placing human closeness at the center of care.",
        ),
    },
    "nelson mandela": {
        "name": "Nelson Mandela",
        "birth_date": date(1918, 7, 18),
        "death_date": date(2013, 12, 5),
        "burial_address": "Qunu, Eastern Cape, South Africa",
        "burial_site_name": "Qunu family grounds",
        "burial_plot_name": "National remembrance",
        "offset": (0.012, 0.007),
        "epitaph": "He joined justice to reconciliation.",
        "biography": make_biography(
            "Nelson Mandela",
            "a statesman and freedom leader whose life became a symbol of dignity under oppression",
            "After decades of resistance to apartheid and years of imprisonment, he helped guide South Africa toward democratic transition and national reconciliation.",
            [
                "His moral authority extended far beyond politics, shaping global conversations about courage, forgiveness, leadership, and equality.",
                "He remains one of the most admired public figures of the modern era.",
            ],
            "He is remembered as a leader who transformed suffering into a wider human hope.",
        ),
    },
    "pablo picasso": {
        "name": "Pablo Picasso",
        "birth_date": date(1881, 10, 25),
        "death_date": date(1973, 4, 8),
        "burial_address": "Mougins, France",
        "burial_site_name": "Château de Vauvenargues memorial grounds",
        "burial_plot_name": "Artist remembrance",
        "offset": (0.013, -0.007),
        "epitaph": "He kept reinventing how vision could become form.",
        "biography": make_biography(
            "Pablo Picasso",
            "one of the most influential and prolific artists of the twentieth century",
            "Working across painting, sculpture, printmaking, ceramics, and design, he repeatedly altered the visual vocabulary of modern art.",
            [
                "His experiments with form, perspective, symbolism, and style shaped the development of modernism in lasting ways.",
                "His work continues to provoke admiration, argument, and sustained artistic study across the globe.",
            ],
            "He is remembered as a maker of restless invention and enduring impact.",
        ),
    },
    "simin daneshvar ccbeoe": {
        "name": "Simin Daneshvar",
        "birth_date": date(1921, 4, 28),
        "death_date": date(2012, 3, 8),
        "burial_address": "Tehran, Iran",
        "burial_site_name": "Behesht-e Zahra memorial record",
        "burial_plot_name": "Literary remembrance",
        "offset": (0.014, 0.008),
        "epitaph": "She wrote women, nation, and memory into lasting form.",
        "biography": make_biography(
            "Simin Daneshvar",
            "a pioneering Iranian novelist, translator, and intellectual voice",
            "Her fiction and essays helped widen the possibilities of modern Persian prose while bringing special depth to questions of identity, social change, and women’s experience.",
            [
                "She remains especially celebrated for her role in the development of Persian narrative literature in the twentieth century.",
                "Her literary legacy continues to inform scholarship, reading culture, and intergenerational conversation.",
            ],
            "She is remembered with admiration for both artistic accomplishment and cultural significance.",
        ),
    },
    "sohrab sepehri": {
        "name": "Sohrab Sepehri",
        "birth_date": date(1928, 10, 7),
        "death_date": date(1980, 4, 21),
        "burial_address": "Kashan, Iran",
        "burial_site_name": "Mashhad-e Ardahal",
        "burial_plot_name": "Poets memorial section",
        "offset": (0.015, -0.008),
        "epitaph": "He found stillness where language met landscape.",
        "biography": make_biography(
            "Sohrab Sepehri",
            "a poet and painter whose work brought unusual calm, clarity, and metaphysical depth to modern Persian art",
            "His poems are loved for their attentiveness to nature, silence, perception, and the spiritual textures of ordinary life.",
            [
                "As both a visual artist and a poet, he developed a distinctive sensibility that continues to attract devoted readers.",
                "His work remains central to the emotional and aesthetic memory of modern Persian culture.",
            ],
            "He is remembered for gentleness, precision, and inward radiance.",
        ),
    },
    "statue of ferdowsi ferdowsi square": {
        "name": "Ferdowsi",
        "birth_date": date(940, 1, 1),
        "death_date": date(1020, 1, 1),
        "burial_address": "Tus, Khorasan, Iran (memorial site)",
        "burial_site_name": "Tomb of Ferdowsi",
        "burial_plot_name": "National literary monument",
        "offset": (0.016, 0.009),
        "epitaph": "He gave epic memory to a civilization.",
        "biography": make_biography(
            "Ferdowsi",
            "the monumental poet whose Shahnameh helped preserve and renew Persian language and cultural memory",
            "His epic imagination gathered myth, history, ethics, kingship, tragedy, and heroism into one of the great literary achievements of the world.",
            [
                "For centuries, his work has shaped Persian identity, literary education, and artistic imagination.",
                "He remains a lasting symbol of cultural continuity, poetic mastery, and civilizational memory.",
            ],
            "He is remembered with reverence as a guardian of language and story.",
        ),
    },
    "steve jobs": {
        "name": "Steve Jobs",
        "birth_date": date(1955, 2, 24),
        "death_date": date(2011, 10, 5),
        "burial_address": "Palo Alto, California, United States (memorial record)",
        "burial_site_name": "Alta Mesa memorial archive",
        "burial_plot_name": "Innovation remembrance",
        "offset": (0.017, -0.009),
        "epitaph": "He insisted that tools could feel human.",
        "biography": make_biography(
            "Steve Jobs",
            "a technology entrepreneur whose product vision reshaped personal computing, media, phones, and design culture",
            "He helped lead the creation of devices and software ecosystems that changed how people communicate, work, create, and relate to technology in everyday life.",
            [
                "His emphasis on simplicity, integration, and user experience left a durable mark on global product design.",
                "He remains an influential figure in conversations about innovation, creativity, leadership, and risk.",
            ],
            "He is remembered as a demanding visionary whose ideas altered modern digital life.",
        ),
    },
}


def get_or_create_admin_user(session: Session) -> User:
    for email in ADMIN_USER_EMAILS:
        user = session.exec(select(User).where(User.email == email)).first()
        if user:
            if user.role != UserRole.ADMIN or not user.is_superuser:
                user.role = UserRole.ADMIN
                user.is_superuser = True
                session.add(user)
                session.flush()
            return user

    user = User(
        email=ADMIN_USER_EMAILS[-1],
        full_name="Halvaa Dev Admin",
        locale="en",
        hashed_password=hash_password(DEV_USER_PASSWORD),
        is_superuser=True,
        role=UserRole.ADMIN,
    )
    session.add(user)
    session.flush()
    return user


def group_images() -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for path in sorted(IMAGE_DIR.iterdir()):
        if not path.is_file():
            continue
        if path.name.startswith("avatar-placeholder"):
            continue
        grouped[normalize_person_key(path.name)].append(path.name)
    return grouped


def ordered_image_paths(filenames: list[str]) -> list[str]:
    return [
        *sorted((name for name in filenames if is_main_image(name)), key=str.lower),
        *sorted((name for name in filenames if not is_main_image(name)), key=str.lower),
    ]


def delete_admin_memorials(session: Session, admin_user_id) -> int:
    memorials = session.exec(select(Memorial).where(Memorial.created_by_id == admin_user_id)).all()
    if not memorials:
        return 0

    memorial_ids = [memorial.id for memorial in memorials]
    session.exec(delete(ReviewEvent).where(ReviewEvent.memorial_id.in_(memorial_ids)))
    session.exec(delete(MemorialContribution).where(MemorialContribution.memorial_id.in_(memorial_ids)))
    session.exec(delete(GuestbookEntry).where(GuestbookEntry.memorial_id.in_(memorial_ids)))
    session.exec(delete(TimelineEvent).where(TimelineEvent.memorial_id.in_(memorial_ids)))
    session.exec(delete(MediaAsset).where(MediaAsset.memorial_id.in_(memorial_ids)))
    session.exec(delete(LandingMemorialPlacement).where(LandingMemorialPlacement.memorial_id.in_(memorial_ids)))
    session.exec(delete(Purchase).where(Purchase.memorial_id.in_(memorial_ids)))
    session.exec(delete(MemorialCollaborator).where(MemorialCollaborator.memorial_id.in_(memorial_ids)))
    session.exec(delete(Memorial).where(Memorial.id.in_(memorial_ids)))
    session.flush()
    return len(memorial_ids)


def build_translations(spec: dict[str, object]) -> dict[str, dict[str, str]]:
    name = str(spec["name"])
    biography = str(spec["biography"])
    epitaph = str(spec["epitaph"])
    return {
        "en": {
            "name": name,
            "biography": biography,
            "epitaph": epitaph,
        },
        "fa": {
            "name": name,
            "biography": biography,
            "epitaph": epitaph,
        },
        "ar": {
            "name": name,
            "biography": biography,
            "epitaph": epitaph,
        },
        "zh": {
            "name": name,
            "biography": biography,
            "epitaph": epitaph,
        },
    }


def import_memorials() -> None:
    grouped_images = group_images()
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        admin = get_or_create_admin_user(session)
        removed_count = delete_admin_memorials(session, admin.id)

        created_count = 0
        for index, (key, filenames) in enumerate(sorted(grouped_images.items()), start=1):
            spec = MEMORIAL_SPECS.get(key)
            if spec is None:
                name = title_from_key(key)
                slug = slugify(name)
                spec = {
                    "name": name,
                    "birth_date": None,
                    "death_date": None,
                    "burial_address": "Memorial location to be confirmed",
                    "burial_site_name": "Public memorial archive",
                    "burial_plot_name": "General remembrance",
                    "offset": (0.0, 0.0),
                    "epitaph": f"{name} is remembered with respect and gratitude.",
                    "biography": (
                        f"{name} is honored in this memorial as a figure of public memory and enduring interest. "
                        f"This profile has been created by the platform administrator to organize available photographs into a single memorial record, "
                        f"preserve a coherent narrative, and provide space for future historical enrichment."
                    ),
                }

            offset_lat, offset_lng = spec["offset"]
            slug = slugify(str(spec["name"]))
            category, metadata, filter_tags = build_memorial_metadata(spec)
            memorial = Memorial(
                public_id=slug,
                slug=slug,
                status=MemorialStatus.FEATURED if index <= 4 else MemorialStatus.PUBLISHED,
                birth_date=spec["birth_date"],
                death_date=spec["death_date"],
                burial_address=spec["burial_address"],
                burial_site_name=spec["burial_site_name"],
                burial_plot_name=spec["burial_plot_name"],
                translations=build_translations(spec),
                category=category,
                meta=metadata,
                filter_tags=filter_tags,
                burial_location=point_from_lat_lng(BASE_LAT + offset_lat, BASE_LNG + offset_lng),
                created_by_id=admin.id,
                published_at=now,
                featured_at=now if index <= 4 else None,
                theme_overrides={"--color-primary": "#FF6B00"},
            )
            session.add(memorial)
            session.flush()

            session.add(
                MemorialCollaborator(
                    memorial_id=memorial.id,
                    user_id=admin.id,
                    role=CollaboratorRole.OWNER,
                    accepted_at=now,
                )
            )

            session.add(
                TimelineEvent(
                    memorial_id=memorial.id,
                    event_type=TimelineEventType.LIFE_EVENT,
                    sort_order=5,
                    event_date=spec["birth_date"],
                    translations=timeline_translations("Childhood", str(metadata["childhood"])),
                )
            )
            session.add(
                TimelineEvent(
                    memorial_id=memorial.id,
                    event_type=TimelineEventType.LIFE_EVENT,
                    sort_order=10,
                    event_date=None,
                    translations=timeline_translations("Family history", str(metadata["family_history"])),
                )
            )

            for sort_order, filename in enumerate(ordered_image_paths(filenames)):
                image_path = f"/images/{filename}"
                image_title = f"{spec['name']} photo {sort_order + 1}"
                session.add(
                    MediaAsset(
                        memorial_id=memorial.id,
                        media_type=MediaType.IMAGE,
                        category=MediaCategory.AVATAR if sort_order == 0 else MediaCategory.GALLERY,
                        original_storage_key=image_path,
                        thumbnail_storage_key=image_path,
                        mime_type="image/png" if filename.lower().endswith(".png") else "image/jpeg",
                        file_size_bytes=0,
                        sort_order=sort_order,
                        processing_status=MediaProcessingStatus.COMPLETED,
                        title=image_title,
                        description=f"Gallery image {sort_order + 1} for {spec['name']}.",
                        translations={"en": {"title": image_title, "description": f"Photograph of {spec['name']}."}},
                    )
                )

            if memorial.status == MemorialStatus.FEATURED:
                session.add(
                    LandingMemorialPlacement(
                        memorial_id=memorial.id,
                        category="featured",
                        sort_order=index - 1,
                        label="Featured by Halvaa",
                    )
                )

            created_count += 1

        session.commit()
        print(f"Removed {removed_count} admin memorials and created {created_count} memorials from public images.")


if __name__ == "__main__":
    import_memorials()
