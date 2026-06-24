"""Seed development data: admin user, published memorials near Tehran, guestbook entries.

Run from backend/:
    .venv/Scripts/python.exe -m scripts.seed_dev_data

Idempotent — skips if memorials already exist.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlmodel import Session, select

from app.core.auth import hash_password
from app.core.database import engine
from app.models.collaborator import MemorialCollaborator
from app.models.enums import (
    CollaboratorRole,
    GuestbookStatus,
    MemorialStatus,
    TimelineEventType,
)
from app.models.guestbook import GuestbookEntry
from app.models.memorial import Memorial
from app.models.timeline import TimelineEvent
from app.models.user import User
from app.services.geo import point_from_lat_lng

DEV_USER_EMAIL = "dev@example.com"
DEV_USER_PASSWORD = "devpassword123"

# Default explore map center (Tehran)
BASE_LAT = 35.6892
BASE_LNG = 51.3890

MEMORIALS: list[dict] = [
    {
        "slug": "margaret-thompson",
        "status": MemorialStatus.FEATURED,
        "birth_date": date(1945, 3, 15),
        "death_date": date(2023, 8, 22),
        "burial_address": "Cambridge, Massachusetts",
        "offset": (0.0, 0.0),
        "translations": {
            "en": {
                "name": "Margaret Ellen Thompson",
                "biography": "Dedicated educator who nurtured a love of literature for forty years.",
                "epitaph": "She lived for the stories.",
            },
            "fa": {
                "name": "مارگارت الن تامپسون",
                "biography": "معلمی دلسوز که چهل سال عشق ادبیات را پروراند.",
                "epitaph": "او برای داستان‌ها زندگی کرد.",
            },
        },
    },
    {
        "slug": "robert-mitchell",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(1938, 7, 4),
        "death_date": date(2022, 11, 12),
        "burial_address": "Boston, Massachusetts",
        "offset": (0.008, 0.01),
        "translations": {
            "en": {"name": "Robert Mitchell", "biography": "Community organizer and jazz pianist."},
            "fa": {"name": "رابرت میچل", "biography": "فعال اجتماعی و نوازنده جاز."},
        },
    },
    {
        "slug": "elena-rodriguez",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(1952, 1, 20),
        "death_date": date(2024, 2, 3),
        "burial_address": "Somerville, Massachusetts",
        "offset": (-0.006, 0.012),
        "translations": {
            "en": {"name": "Elena Rodriguez", "biography": "Pediatric nurse and neighborhood volunteer."},
            "fa": {"name": "النا رودریگز", "biography": "پرستار کودکان و داوطلب محله."},
        },
    },
    {
        "slug": "david-chen",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(1960, 5, 8),
        "death_date": date(2021, 9, 17),
        "burial_address": "Brookline, Massachusetts",
        "offset": (0.012, -0.008),
        "translations": {
            "en": {"name": "David Chen", "biography": "Architect who shaped public spaces across New England."},
            "fa": {"name": "دیوید چن", "biography": "معماری که فضاهای عمومی نیوانگلند را شکل داد."},
        },
    },
    {
        "slug": "sarah-williams",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(1948, 11, 30),
        "death_date": date(2020, 4, 5),
        "burial_address": "Newton, Massachusetts",
        "offset": (-0.01, -0.006),
        "translations": {
            "en": {"name": "Sarah Williams", "biography": "Historian and preservation advocate."},
            "fa": {"name": "سارا ویلیامز", "biography": "تاریخ‌نگار و مدافع میراث فرهنگی."},
        },
    },
    {
        "slug": "ferdowsi",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(940, 1, 1),
        "death_date": date(1020, 1, 1),
        "burial_address": "Tus, Khorasan (memorial site)",
        "offset": (0.004, 0.006),
        "translations": {
            "en": {
                "name": "Ferdowsi",
                "biography": "Epic poet of Iran and author of the Shahnameh.",
                "epitaph": "He revived the Persian language through verse.",
            },
            "fa": {
                "name": "فردوسی",
                "biography": "حماسه‌سرای ایرانی و خالق شاهنامه.",
                "epitaph": "زبان فارسی را با شعر زنده کرد.",
            },
        },
    },
    {
        "slug": "parvin-etesami",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(1907, 3, 16),
        "death_date": date(1941, 4, 5),
        "burial_address": "Tehran, Iran (memorial site)",
        "offset": (-0.004, 0.008),
        "translations": {
            "en": {"name": "Parvin Etesami", "biography": "Celebrated Persian poet and essayist."},
            "fa": {"name": "پروین اعتصامی", "biography": "شاعر و نویسنده برجسته فارسی."},
        },
    },
    {
        "slug": "sohrab-sepehri",
        "status": MemorialStatus.PUBLISHED,
        "birth_date": date(1928, 10, 7),
        "death_date": date(1980, 4, 21),
        "burial_address": "Kashan, Iran (memorial site)",
        "offset": (0.006, -0.004),
        "translations": {
            "en": {"name": "Sohrab Sepehri", "biography": "Modern poet and painter of quiet landscapes."},
            "fa": {"name": "سهراب سپهری", "biography": "شاعر و نقاش معاصر منظره‌های آرام."},
        },
    },
]

TIMELINE_BY_SLUG: dict[str, list[dict]] = {
    "margaret-thompson": [
        {
            "event_type": TimelineEventType.BIOGRAPHY,
            "sort_order": 0,
            "translations": {
                "en": {
                    "title": "A life devoted to literature",
                    "body": "Margaret dedicated forty years to teaching English.",
                },
                "fa": {
                    "title": "زندگی‌ای وقف ادبیات",
                    "body": "مارگارت چهل سال به تدریس زبان انگلیسی پرداخت.",
                },
            },
        },
        {
            "event_type": TimelineEventType.LIFE_EVENT,
            "sort_order": 1,
            "event_date": date(1965, 9, 1),
            "translations": {
                "en": {
                    "title": "Began teaching at Cambridge High",
                    "body": "She joined the faculty and quickly became a beloved mentor.",
                },
                "fa": {
                    "title": "شروع تدریس در دبیرستان کمبریج",
                    "body": "به کادر آموزشی پیوست و به زودی محبوب شد.",
                },
            },
        },
    ],
    "ferdowsi": [
        {
            "event_type": TimelineEventType.BIOGRAPHY,
            "sort_order": 0,
            "translations": {
                "en": {"title": "Poet of the Shahnameh", "body": "Author of Iran's national epic."},
                "fa": {"title": "سراینده شاهنامه", "body": "خالق حماسه ملی ایران."},
            },
        },
        {
            "event_type": TimelineEventType.LIFE_EVENT,
            "sort_order": 1,
            "event_date": date(1010, 1, 1),
            "translations": {
                "en": {"title": "Completion of the Shahnameh", "body": "A work that shaped Persian identity for centuries."},
                "fa": {"title": "پایان سرایش شاهنامه", "body": "اثری که هویت فرهنگی ایران را شکل داد."},
            },
        },
    ],
}

GUESTBOOK_BY_SLUG: dict[str, list[dict]] = {
    "margaret-thompson": [
        {"author_name": "Former student", "message": "Thank you for believing in every story we wrote.", "status": GuestbookStatus.APPROVED},
        {"author_name": "Colleague", "message": "Your classroom was a sanctuary of curiosity.", "status": GuestbookStatus.APPROVED},
        {"author_name": "Visitor", "message": "Rest in peace, dear teacher.", "status": GuestbookStatus.PENDING},
    ],
}


def get_or_create_dev_user(session: Session) -> User:
    user = session.exec(select(User).where(User.email == DEV_USER_EMAIL)).first()
    if user:
        return user

    user = User(
        email=DEV_USER_EMAIL,
        full_name="Halvaa Dev Admin",
        locale="en",
        hashed_password=hash_password(DEV_USER_PASSWORD),
        is_superuser=True,
    )
    session.add(user)
    session.flush()
    return user


def seed() -> None:
    with Session(engine) as session:
        get_or_create_dev_user(session)

        user = session.exec(select(User).where(User.email == DEV_USER_EMAIL)).one()
        now = datetime.now(timezone.utc)

        for spec in MEMORIALS:
            lat_offset, lng_offset = spec["offset"]
            memorial = session.exec(select(Memorial).where(Memorial.slug == spec["slug"])).first()
            if memorial is None:
                memorial = Memorial(slug=spec["slug"], created_by_id=user.id)

            memorial.status = spec["status"]
            memorial.birth_date = spec.get("birth_date")
            memorial.death_date = spec.get("death_date")
            memorial.burial_address = spec.get("burial_address")
            memorial.translations = spec["translations"]
            memorial.burial_location = point_from_lat_lng(
                BASE_LAT + lat_offset,
                BASE_LNG + lng_offset,
            )
            memorial.created_by_id = user.id
            memorial.published_at = now if spec["status"] in {MemorialStatus.PUBLISHED, MemorialStatus.FEATURED} else None
            memorial.featured_at = now if spec["status"] == MemorialStatus.FEATURED else None
            session.add(memorial)
            session.flush()

            collaborator = session.exec(
                select(MemorialCollaborator).where(
                    MemorialCollaborator.memorial_id == memorial.id,
                    MemorialCollaborator.user_id == user.id,
                )
            ).first()
            if collaborator is None:
                session.add(
                    MemorialCollaborator(
                        memorial_id=memorial.id,
                        user_id=user.id,
                        role=CollaboratorRole.OWNER,
                    )
                )

            existing_events = session.exec(
                select(TimelineEvent).where(TimelineEvent.memorial_id == memorial.id)
            ).all()
            if not existing_events:
                for event_spec in TIMELINE_BY_SLUG.get(spec["slug"], []):
                    session.add(
                        TimelineEvent(
                            memorial_id=memorial.id,
                            event_type=event_spec["event_type"],
                            sort_order=event_spec["sort_order"],
                            event_date=event_spec.get("event_date"),
                            translations=event_spec["translations"],
                        )
                    )

            existing_guestbook = session.exec(
                select(GuestbookEntry).where(GuestbookEntry.memorial_id == memorial.id)
            ).all()
            if not existing_guestbook:
                for entry_spec in GUESTBOOK_BY_SLUG.get(spec["slug"], []):
                    session.add(
                        GuestbookEntry(
                            memorial_id=memorial.id,
                            author_name=entry_spec["author_name"],
                            message=entry_spec["message"],
                            status=entry_spec["status"],
                        )
                    )

        session.commit()
        print(f"Seeded dev user ({DEV_USER_EMAIL}) and {len(MEMORIALS)} memorials near Tehran.")


if __name__ == "__main__":
    seed()
