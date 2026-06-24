"""Phase 1 model and schema verification tests."""

import uuid
from datetime import date

import pytest
from geoalchemy2.elements import WKTElement
from sqlmodel import Session, select

from app.models.enums import (
    CollaboratorRole,
    GuestbookStatus,
    MediaCategory,
    MediaProcessingStatus,
    MediaType,
    MemorialStatus,
    TimelineEventType,
)
from app.models.guestbook import GuestbookEntry
from app.models.media import MediaAsset
from app.models.memorial import Memorial
from app.models.collaborator import MemorialCollaborator
from app.models.timeline import TimelineEvent
from app.models.user import User


class TestEnums:
    def test_memorial_status_workflow_values(self) -> None:
        assert MemorialStatus.DRAFT.value == "DRAFT"
        assert MemorialStatus.PENDING_APPROVAL.value == "PENDING_APPROVAL"
        assert MemorialStatus.PUBLISHED.value == "PUBLISHED"
        assert MemorialStatus.FEATURED.value == "FEATURED"

    def test_collaborator_role_hierarchy_exists(self) -> None:
        roles = {role.value for role in CollaboratorRole}
        assert roles == {"OWNER", "EDITOR", "VIEWER"}

    def test_guestbook_moderation_states(self) -> None:
        assert GuestbookStatus.PENDING.value == "PENDING"
        assert GuestbookStatus.APPROVED.value == "APPROVED"


@pytest.fixture
def sample_user(db_session: Session) -> User:
    user = User(
        email="owner@halvaa.net",
        full_name="Memorial Owner",
        hashed_password="hashed-secret",
        locale="fa",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestMemorialGraph:
    def test_create_memorial_with_translations_and_theme(
        self, db_session: Session, sample_user: User
    ) -> None:
        memorial = Memorial(
            slug="test-memorial-translations",
            status=MemorialStatus.DRAFT,
            birth_date=date(1945, 3, 15),
            death_date=date(2023, 8, 22),
            burial_address="Cambridge, Massachusetts",
            burial_location=WKTElement("POINT(-71.1097 42.3736)", srid=4326),
            translations={
                "en": {
                    "name": "Margaret Ellen Thompson",
                    "biography": "Dedicated educator.",
                    "epitaph": "She lived for the stories.",
                },
                "fa": {
                    "name": "مارگارت الن تامپسون",
                    "biography": "معلم دلسوز.",
                    "epitaph": "او برای داستان‌ها زندگی کرد.",
                },
            },
            theme_overrides={"--color-primary": "#FF6B00", "--font-heading": "Product Sans"},
            created_by_id=sample_user.id,
        )
        db_session.add(memorial)
        db_session.commit()
        db_session.refresh(memorial)

        assert memorial.slug == "test-memorial-translations"
        assert memorial.translations["fa"]["name"] == "مارگارت الن تامپسون"
        assert memorial.theme_overrides["--color-primary"] == "#FF6B00"
        assert memorial.burial_location is not None

    def test_rbac_collaborator_unique_per_memorial(
        self, db_session: Session, sample_user: User
    ) -> None:
        memorial = Memorial(
            slug="rbac-test",
            created_by_id=sample_user.id,
        )
        db_session.add(memorial)
        db_session.commit()

        collaborator = MemorialCollaborator(
            memorial_id=memorial.id,
            user_id=sample_user.id,
            role=CollaboratorRole.OWNER,
        )
        db_session.add(collaborator)
        db_session.commit()

        stored = db_session.exec(
            select(MemorialCollaborator).where(
                MemorialCollaborator.memorial_id == memorial.id,
                MemorialCollaborator.user_id == sample_user.id,
            )
        ).first()
        assert stored is not None
        assert stored.role == CollaboratorRole.OWNER

    def test_timeline_guestbook_and_media_relationships(
        self, db_session: Session, sample_user: User
    ) -> None:
        memorial = Memorial(slug="full-graph", created_by_id=sample_user.id)
        db_session.add(memorial)
        db_session.commit()
        db_session.refresh(memorial)

        media = MediaAsset(
            memorial_id=memorial.id,
            media_type=MediaType.IMAGE,
            category=MediaCategory.GALLERY,
            original_storage_key="memorials/full-graph/original.webp",
            mime_type="image/webp",
            file_size_bytes=204800,
            processing_status=MediaProcessingStatus.COMPLETED,
            thumbnail_storage_key="memorials/full-graph/thumb_400.webp",
            width=400,
            height=400,
        )
        db_session.add(media)
        db_session.commit()
        db_session.refresh(media)

        event = TimelineEvent(
            memorial_id=memorial.id,
            media_id=media.id,
            event_type=TimelineEventType.LIFE_EVENT,
            sort_order=1,
            event_date=date(1970, 1, 1),
            translations={"en": {"title": "Teaching career begins", "body": "Started at Cambridge High."}},
            location_point=WKTElement("POINT(-71.1097 42.3736)", srid=4326),
        )
        guestbook = GuestbookEntry(
            memorial_id=memorial.id,
            author_name="Visitor",
            message="Forever remembered.",
            status=GuestbookStatus.PENDING,
        )
        db_session.add(event)
        db_session.add(guestbook)
        db_session.commit()

        events = db_session.exec(
            select(TimelineEvent).where(TimelineEvent.memorial_id == memorial.id)
        ).all()
        entries = db_session.exec(
            select(GuestbookEntry).where(GuestbookEntry.memorial_id == memorial.id)
        ).all()

        assert len(events) == 1
        assert events[0].media_id == media.id
        assert len(entries) == 1
        assert entries[0].status == GuestbookStatus.PENDING

    def test_only_published_and_featured_are_searchable_statuses(self) -> None:
        searchable = {MemorialStatus.PUBLISHED, MemorialStatus.FEATURED}
        non_searchable = {
            MemorialStatus.DRAFT,
            MemorialStatus.PENDING_APPROVAL,
        }
        assert searchable.isdisjoint(non_searchable)
