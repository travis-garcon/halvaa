"""Integration tests against the real API routes and database."""

from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.deps import get_db
from app.main import app


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class TestExploreAndMemorials:
    def test_nearby_returns_geojson(self, client: TestClient, test_memorial) -> None:
        response = client.get(
            "/api/v1/explore/nearby",
            params={"latitude": 42.3601, "longitude": -71.0589, "radius_m": 10000, "locale": "en"},
        )
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "no-store, max-age=0"
        assert response.headers["CDN-Cache-Control"] == "no-store"
        assert response.headers["Surrogate-Control"] == "no-store"
        assert response.headers["Pragma"] == "no-cache"
        payload = response.json()
        assert payload["type"] == "FeatureCollection"
        assert len(payload["features"]) >= 1
        feature = payload["features"][0]
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "Point"
        assert "slug" in feature["properties"]
        assert "distance_m" in feature["properties"]
        assert "burial_site_name" in feature["properties"]
        assert "burial_plot_name" in feature["properties"]
        assert "is_verified" in feature["properties"]
        assert "view_count" in feature["properties"]

    def test_public_view_counter_is_persisted(
        self, client: TestClient, db_session: Session, test_memorial
    ) -> None:
        before = test_memorial.view_count
        response = client.post(f"/api/v1/memorials/{test_memorial.id}/view")
        assert response.status_code == 204
        db_session.refresh(test_memorial)
        assert test_memorial.view_count == before + 1

        profile = client.get(f"/api/v1/memorials/slug/{test_memorial.slug}")
        assert profile.status_code == 200
        assert profile.json()["view_count"] == before + 1

    def test_memorial_by_slug_returns_profile(self, client: TestClient, test_memorial) -> None:
        response = client.get(f"/api/v1/memorials/slug/{test_memorial.slug}")
        assert response.status_code == 200
        payload = response.json()
        assert payload["slug"] == test_memorial.slug
        assert payload["status"] in {"PUBLISHED", "FEATURED"}
        assert payload["translations"]["en"]["name"]
        assert payload["latitude"] is not None
        assert payload["longitude"] is not None
        assert isinstance(payload["timeline_events"], list)
        assert payload["guestbook_approved_count"] >= 0

    def test_unpublished_memorial_hidden_from_public(
        self, client: TestClient, db_session: Session, test_user
    ) -> None:
        from app.models.enums import MemorialStatus
        from app.models.memorial import Memorial

        memorial = Memorial(
            public_id="hidden-draft-test",
            slug="hidden-draft-test",
            status=MemorialStatus.DRAFT,
            created_by_id=test_user.id,
        )
        db_session.add(memorial)
        db_session.flush()

        response = client.get("/api/v1/memorials/slug/hidden-draft-test")
        assert response.status_code == 404

    def test_discover_featured_returns_only_featured(self, client: TestClient, db_session: Session, test_user) -> None:
        from app.models.enums import MemorialStatus
        from app.models.memorial import Memorial

        now = datetime.now(timezone.utc)
        featured = Memorial(
            public_id="discover-featured",
            slug="discover-featured",
            status=MemorialStatus.FEATURED,
            created_by_id=test_user.id,
            translations={"en": {"name": "Featured Memorial"}},
            published_at=now - timedelta(days=3),
            featured_at=now,
        )
        published = Memorial(
            public_id="discover-published",
            slug="discover-published",
            status=MemorialStatus.PUBLISHED,
            created_by_id=test_user.id,
            translations={"en": {"name": "Published Memorial"}},
            published_at=now - timedelta(days=1),
        )
        db_session.add(featured)
        db_session.add(published)
        db_session.flush()

        response = client.get("/api/v1/explore/discover", params={"kind": "featured", "locale": "en", "limit": 10})
        assert response.status_code == 200
        items = response.json()["items"]
        assert any(item["slug"] == "discover-featured" for item in items)
        assert all(item["status"] == "FEATURED" for item in items)

    def test_discover_latest_orders_by_published_at(self, client: TestClient, db_session: Session, test_user) -> None:
        from app.models.enums import MemorialStatus
        from app.models.memorial import Memorial

        now = datetime.now(timezone.utc)
        older = Memorial(
            public_id="discover-latest-older",
            slug="discover-latest-older",
            status=MemorialStatus.PUBLISHED,
            created_by_id=test_user.id,
            translations={"en": {"name": "Older Memorial"}},
            published_at=now - timedelta(days=4),
        )
        newer = Memorial(
            public_id="discover-latest-newer",
            slug="discover-latest-newer",
            status=MemorialStatus.PUBLISHED,
            created_by_id=test_user.id,
            translations={"en": {"name": "Newer Memorial"}},
            published_at=now - timedelta(days=1),
        )
        db_session.add(older)
        db_session.add(newer)
        db_session.flush()

        response = client.get("/api/v1/explore/discover", params={"kind": "latest", "locale": "en", "limit": 10})
        assert response.status_code == 200
        items = response.json()["items"]
        newer_index = next(index for index, item in enumerate(items) if item["slug"] == "discover-latest-newer")
        older_index = next(index for index, item in enumerate(items) if item["slug"] == "discover-latest-older")
        assert newer_index < older_index

    def test_discover_includes_burial_site_fields(self, client: TestClient, db_session: Session, test_user) -> None:
        from app.models.enums import MemorialStatus
        from app.models.memorial import Memorial

        memorial = Memorial(
            public_id="discover-burial-site",
            slug="discover-burial-site",
            status=MemorialStatus.PUBLISHED,
            created_by_id=test_user.id,
            translations={"en": {"name": "Burial Site Memorial"}},
            burial_site_name="Oak Rest Gardens",
            burial_plot_name="Section B / Plot 14",
        )
        db_session.add(memorial)
        db_session.flush()

        response = client.get("/api/v1/explore/discover", params={"kind": "updated", "locale": "en", "limit": 10})
        assert response.status_code == 200
        item = next(entry for entry in response.json()["items"] if entry["slug"] == "discover-burial-site")
        assert item["burial_site_name"] == "Oak Rest Gardens"
        assert item["burial_plot_name"] == "Section B / Plot 14"


class TestGuestbook:
    def test_list_approved_only(self, client: TestClient, test_memorial, db_session: Session) -> None:
        from app.models.enums import GuestbookStatus
        from app.models.guestbook import GuestbookEntry

        db_session.add(
            GuestbookEntry(
                memorial_id=test_memorial.id,
                author_name="Approved Visitor",
                message="Remembered with love.",
                status=GuestbookStatus.APPROVED,
            )
        )
        db_session.flush()

        response = client.get(f"/api/v1/memorials/{test_memorial.id}/guestbook")
        assert response.status_code == 200
        entries = response.json()
        assert all(entry["status"] == "APPROVED" for entry in entries)

    def test_create_guestbook_entry_pending(self, client: TestClient, test_memorial) -> None:
        response = client.post(
            f"/api/v1/memorials/{test_memorial.id}/guestbook",
            json={
                "author_name": "Test Visitor",
                "message": "Remembered with love.",
                "tribute_type": "TRIBUTE",
                "relationship_label": "Family friend",
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == "PENDING"
        assert response.json()["tribute_type"] == "TRIBUTE"
        assert response.json()["relationship_label"] == "Family friend"

    def test_pending_queue_returns_entries_for_owner(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        owner = client.post(
            "/api/v1/auth/register",
            json={
                "email": "queue-owner@example.com",
                "password": "testpass123",
                "full_name": "Queue Owner",
                "locale": "en",
            },
        )
        assert owner.status_code == 201
        token = owner.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        reviewer = User(
            email="queue-reviewer@example.com",
            full_name="Queue Reviewer",
            locale="en",
            hashed_password=hash_password("testpass123"),
            is_superuser=True,
        )
        db_session.add(reviewer)
        db_session.commit()
        reviewer_headers = {"Authorization": f"Bearer {create_access_token(reviewer.id)}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "queue-owner-memorial",
                "status": "DRAFT",
                "translations": {"en": {"name": "Queue Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        pending = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=headers,
            json={"status": "PENDING_APPROVAL"},
        )
        assert pending.status_code == 200

        publish = client.post(
            f"/api/v1/memorials/{memorial_id}/review",
            headers=reviewer_headers,
            json={"decision": "APPROVE"},
        )
        assert publish.status_code == 200
        assert publish.json()["last_reviewed_at"] is not None
        assert publish.json()["last_review_decision"] == "APPROVE"
        assert publish.json()["last_reviewed_by_name"] == "Queue Reviewer"

        entry = client.post(
            f"/api/v1/memorials/{memorial_id}/guestbook",
            json={"author_name": "Queue Visitor", "message": "A pending memory."},
        )
        assert entry.status_code == 201
        entry_id = entry.json()["id"]

        queue = client.get("/api/v1/guestbook/pending", headers=headers)
        assert queue.status_code == 200
        items = queue.json()
        assert any(item["memorial_slug"] == "queue-owner-memorial" for item in items)

        moderated = client.patch(
            f"/api/v1/memorials/{memorial_id}/guestbook/{entry_id}",
            headers=headers,
            json={"status": "APPROVED"},
        )
        assert moderated.status_code == 200
        assert moderated.json()["moderated_at"] is not None
        assert moderated.json()["moderated_by_name"] == "Queue Owner"


class TestAuth:
    def test_register_and_me(self, client: TestClient) -> None:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "integration-test@example.com",
                "password": "testpass123",
                "full_name": "Integration Test",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "integration-test@example.com"
        assert me.json()["profile_completion_percent"] == 60
        assert set(me.json()["missing_profile_fields"]) == {"phone_number", "address"}

        completed = client.patch(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+15555550123", "address": "21 Memory Lane"},
        )
        assert completed.status_code == 200
        assert completed.json()["address"] == "21 Memory Lane"
        assert completed.json()["profile_completed"] is True
        assert completed.json()["profile_completion_percent"] == 100

    def test_login_with_form(self, client: TestClient) -> None:
        client.post(
            "/api/v1/auth/register",
            json={
                "email": "login-test@example.com",
                "password": "testpass123",
                "full_name": "Login Test",
                "locale": "en",
            },
        )
        login = client.post(
            "/api/v1/auth/login",
            data={"username": "login-test@example.com", "password": "testpass123"},
        )
        assert login.status_code == 200
        assert login.json()["token_type"] == "bearer"


class TestMemorialManagement:
    def test_create_memorial_as_owner_and_list_mine(self, client: TestClient) -> None:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "owner-flow@example.com",
                "password": "testpass123",
                "full_name": "Owner Flow",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "owner-flow-memorial",
                "status": "DRAFT",
                "birth_date": "1930-01-01",
                "death_date": "2001-02-03",
                "burial_address": "Evergreen Cemetery",
                "translations": {"en": {"name": "Owner Flow Memorial", "biography": "A life remembered."}},
                "latitude": 42.3601,
                "longitude": -71.0589,
            },
        )
        assert create.status_code == 201
        created = create.json()
        assert created["slug"] == "owner-flow-memorial"
        assert created["status"] == "DRAFT"
        assert created["translations"]["en"]["name"] == "Owner Flow Memorial"
        assert created["latitude"] == pytest.approx(42.3601)
        assert created["longitude"] == pytest.approx(-71.0589)

        mine = client.get("/api/v1/memorials/mine", headers=headers)
        assert mine.status_code == 200
        payload = mine.json()
        assert len(payload) == 1
        assert payload[0]["id"] == created["id"]
        assert payload[0]["status"] == "DRAFT"

    def test_owner_submits_for_approval_and_superuser_reviews(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "publish-flow@example.com",
                "password": "testpass123",
                "full_name": "Publish Flow",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        reviewer = User(
            email="publish-reviewer@example.com",
            full_name="Publish Reviewer",
            locale="en",
            hashed_password=hash_password("testpass123"),
            is_superuser=True,
        )
        db_session.add(reviewer)
        db_session.commit()
        reviewer_headers = {"Authorization": f"Bearer {create_access_token(reviewer.id)}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "publish-flow-memorial",
                "status": "DRAFT",
                "translations": {"en": {"name": "Publish Flow Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        pending = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=headers,
            json={"status": "PENDING_APPROVAL"},
        )
        assert pending.status_code == 200
        assert pending.json()["status"] == "PENDING_APPROVAL"

        queue_for_owner = client.get("/api/v1/memorials/pending-approvals", headers=headers)
        assert queue_for_owner.status_code == 200
        assert queue_for_owner.json() == []

        queue_for_reviewer = client.get("/api/v1/memorials/pending-approvals?locale=en", headers=reviewer_headers)
        assert queue_for_reviewer.status_code == 200
        assert any(item["slug"] == "publish-flow-memorial" for item in queue_for_reviewer.json())

        published = client.post(
            f"/api/v1/memorials/{memorial_id}/review",
            headers=reviewer_headers,
            json={"decision": "APPROVE"},
        )
        assert published.status_code == 200
        assert published.json()["status"] == "PUBLISHED"
        assert published.json()["published_at"] is not None
        assert published.json()["last_reviewed_at"] is not None
        assert published.json()["last_review_decision"] == "APPROVE"
        assert published.json()["last_reviewed_by_name"] == "Publish Reviewer"

        featured = client.post(
            f"/api/v1/memorials/{memorial_id}/review",
            headers=reviewer_headers,
            json={"decision": "FEATURE"},
        )
        assert featured.status_code == 400

        public_profile = client.get("/api/v1/memorials/slug/publish-flow-memorial")
        assert public_profile.status_code == 200
        assert public_profile.json()["status"] == "PUBLISHED"

        featured_after_publish = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=reviewer_headers,
            json={"status": "FEATURED"},
        )
        assert featured_after_publish.status_code == 200
        assert featured_after_publish.json()["status"] == "FEATURED"
        assert featured_after_publish.json()["featured_at"] is not None

    def test_owner_can_publish_draft_without_review_capability(self, client: TestClient) -> None:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "owner-no-review@example.com",
                "password": "testpass123",
                "full_name": "Owner No Review",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "owner-no-review",
                "status": "DRAFT",
                "translations": {"en": {"name": "Owner No Review"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        published = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=headers,
            json={"status": "PUBLISHED"},
        )
        assert published.status_code == 200
        assert published.json()["status"] == "PUBLISHED"

    def test_review_history_includes_memorial_and_guestbook_activity(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "history-owner@example.com",
                "password": "testpass123",
                "full_name": "History Owner",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

        reviewer = User(
            email="history-reviewer@example.com",
            full_name="History Reviewer",
            locale="en",
            hashed_password=hash_password("testpass123"),
            is_superuser=True,
        )
        db_session.add(reviewer)
        db_session.commit()
        reviewer_headers = {"Authorization": f"Bearer {create_access_token(reviewer.id)}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "history-owner-memorial",
                "status": "DRAFT",
                "translations": {"en": {"name": "History Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        pending = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=headers,
            json={"status": "PENDING_APPROVAL"},
        )
        assert pending.status_code == 200

        reviewed = client.post(
            f"/api/v1/memorials/{memorial_id}/review",
            headers=reviewer_headers,
            json={"decision": "REQUEST_CHANGES"},
        )
        assert reviewed.status_code == 200

        resubmitted = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=headers,
            json={"status": "PENDING_APPROVAL"},
        )
        assert resubmitted.status_code == 200

        reviewed = client.post(
            f"/api/v1/memorials/{memorial_id}/review",
            headers=reviewer_headers,
            json={"decision": "APPROVE"},
        )
        assert reviewed.status_code == 200

        entry = client.post(
            f"/api/v1/memorials/{memorial_id}/guestbook",
            json={"author_name": "History Visitor", "message": "A recent memory."},
        )
        assert entry.status_code == 201
        entry_id = entry.json()["id"]

        moderated = client.patch(
            f"/api/v1/memorials/{memorial_id}/guestbook/{entry_id}",
            headers=headers,
            json={"status": "APPROVED"},
        )
        assert moderated.status_code == 200

        history = client.get(f"/api/v1/memorials/{memorial_id}/review-history", headers=headers)
        assert history.status_code == 200
        items = history.json()
        assert len(items) == 3
        assert items[0]["kind"] == "GUESTBOOK_MODERATION"
        assert items[0]["decision"] == "APPROVED"
        assert items[0]["subject_name"] == "History Visitor"
        assert items[0]["reviewer_name"] == "History Owner"
        assert items[1]["kind"] == "MEMORIAL_REVIEW"
        assert items[1]["decision"] == "APPROVE"
        assert items[1]["subject_name"] == "History Owner Memorial"
        assert items[1]["reviewer_name"] == "History Reviewer"
        assert items[2]["kind"] == "MEMORIAL_REVIEW"
        assert items[2]["decision"] == "REQUEST_CHANGES"
        assert items[2]["subject_name"] == "History Owner Memorial"
        assert items[2]["reviewer_name"] == "History Reviewer"

    def test_non_owner_cannot_change_memorial_status(self, client: TestClient, test_memorial) -> None:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "outsider-flow@example.com",
                "password": "testpass123",
                "full_name": "Outsider Flow",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            f"/api/v1/memorials/{test_memorial.id}/status",
            headers=headers,
            json={"status": "FEATURED"},
        )
        assert response.status_code == 403

    def test_owner_can_create_update_and_delete_timeline_event(self, client: TestClient) -> None:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "timeline-owner@example.com",
                "password": "testpass123",
                "full_name": "Timeline Owner",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "timeline-owner-memorial",
                "translations": {"en": {"name": "Timeline Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        created_event = client.post(
            f"/api/v1/memorials/{memorial_id}/timeline",
            headers=headers,
            json={
                "event_type": "LIFE_EVENT",
                "sort_order": 2,
                "event_date": "1950-01-01",
                "translations": {"en": {"title": "Graduation", "body": "A milestone moment."}},
            },
        )
        assert created_event.status_code == 201
        event_id = created_event.json()["id"]
        assert created_event.json()["translations"]["en"]["title"] == "Graduation"

        updated_event = client.patch(
            f"/api/v1/memorials/{memorial_id}/timeline/{event_id}",
            headers=headers,
            json={
                "sort_order": 1,
                "translations": {"en": {"title": "University graduation", "body": "A milestone moment."}},
            },
        )
        assert updated_event.status_code == 200
        assert updated_event.json()["sort_order"] == 1
        assert updated_event.json()["translations"]["en"]["title"] == "University graduation"

        profile = client.get(f"/api/v1/memorials/slug/timeline-owner-memorial", headers=headers)
        assert profile.status_code == 200
        assert any(event["id"] == event_id for event in profile.json()["timeline_events"])

        deleted_event = client.delete(
            f"/api/v1/memorials/{memorial_id}/timeline/{event_id}",
            headers=headers,
        )
        assert deleted_event.status_code == 204

        profile_after_delete = client.get(f"/api/v1/memorials/slug/timeline-owner-memorial", headers=headers)
        assert profile_after_delete.status_code == 200

    def test_owner_can_update_media_metadata(
        self, client: TestClient, db_session: Session, tmp_path: Path
    ) -> None:
        from app.models.enums import MediaCategory, MediaProcessingStatus, MediaType
        from app.models.media import MediaAsset
        from app.models.timeline import TimelineEvent

        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "media-owner@example.com",
                "password": "testpass123",
                "full_name": "Media Owner",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "media-owner-memorial",
                "translations": {"en": {"name": "Media Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        artifact_path = tmp_path / "test-artifact.jpg"
        artifact_path.write_bytes(b"test artifact")

        asset = MediaAsset(
            memorial_id=memorial_id,
            media_type=MediaType.IMAGE,
            category=MediaCategory.GALLERY,
            original_storage_key=str(artifact_path),
            thumbnail_storage_key=None,
            mime_type="image/jpeg",
            file_size_bytes=1024,
            sort_order=0,
            processing_status=MediaProcessingStatus.COMPLETED,
            translations={},
        )
        db_session.add(asset)
        db_session.commit()
        db_session.refresh(asset)

        updated = client.patch(
            f"/api/v1/memorials/{memorial_id}/media/{asset.id}",
            headers=headers,
            json={
                "title": "Pocket watch",
                "description": "Carried every day for decades.",
                "translations": {"meta": {"asset_kind": "ARTIFACT"}},
            },
        )
        assert updated.status_code == 200
        assert updated.json()["title"] == "Pocket watch"
        assert updated.json()["description"] == "Carried every day for decades."
        assert updated.json()["translations"]["meta"]["asset_kind"] == "ARTIFACT"

        profile = client.get("/api/v1/memorials/slug/media-owner-memorial", headers=headers)
        assert profile.status_code == 200
        assert profile.json()["artifacts"][0]["title"] == "Pocket watch"
        assert "?v=" in updated.json()["original_url"]

        event = TimelineEvent(
            memorial_id=memorial_id,
            event_type="LIFE_EVENT",
            sort_order=0,
            translations={"en": {"title": "Keepsake event"}},
            media_id=asset.id,
        )
        db_session.add(event)
        db_session.commit()

        deleted = client.delete(f"/api/v1/memorials/{memorial_id}/media/{asset.id}", headers=headers)
        assert deleted.status_code == 204
        db_session.refresh(event)
        assert event.media_id is None

    def test_owner_can_save_family_tree(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "family-owner@example.com",
                "password": "testpass123",
                "full_name": "Family Owner",
                "locale": "en",
            },
        )
        assert register.status_code == 201
        headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

        create = client.post(
            "/api/v1/memorials",
            headers=headers,
            json={
                "slug": "family-owner-memorial",
                "status": "DRAFT",
                "translations": {"en": {"name": "Family Owner Memorial"}},
                "family_tree": [
                    {"name": "Mary Owner", "relation": "Spouse", "years": "1940 - 2018"},
                    {"name": "Leila Owner", "relation": "Daughter"},
                ],
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        updated = client.patch(
            f"/api/v1/memorials/{memorial_id}",
            headers=headers,
            json={
                "family_tree": [
                    {"name": "Mary Owner", "relation": "Spouse", "years": "1940 - 2018"},
                    {"name": "Leila Owner", "relation": "Daughter"},
                    {"name": "Dariush Owner", "relation": "Son"},
                ],
            },
        )
        assert updated.status_code == 200
        assert len(updated.json()["family_tree"]) == 3

        pending = client.post(
            f"/api/v1/memorials/{memorial_id}/status",
            headers=headers,
            json={"status": "PENDING_APPROVAL"},
        )
        assert pending.status_code == 200

        reviewer = User(
            email="family-reviewer@example.com",
            full_name="Family Reviewer",
            locale="en",
            hashed_password=hash_password("testpass123"),
            is_superuser=True,
        )
        db_session.add(reviewer)
        db_session.commit()
        reviewer_headers = {"Authorization": f"Bearer {create_access_token(reviewer.id)}"}

        reviewed = client.post(
            f"/api/v1/memorials/{memorial_id}/review",
            headers=reviewer_headers,
            json={"decision": "APPROVE"},
        )
        assert reviewed.status_code == 200

        profile = client.get("/api/v1/memorials/slug/family-owner-memorial")
        assert profile.status_code == 200
        assert len(profile.json()["family_tree"]) == 3
        assert profile.json()["family_tree"][0]["relation"] == "Spouse"


    def test_owner_can_add_and_list_collaborators(self, client: TestClient) -> None:
        owner = client.post(
            "/api/v1/auth/register",
            json={
                "email": "collab-owner@example.com",
                "password": "testpass123",
                "full_name": "Collab Owner",
                "locale": "en",
            },
        )
        assert owner.status_code == 201
        owner_headers = {"Authorization": f"Bearer {owner.json()['access_token']}"}

        collaborator_user = client.post(
            "/api/v1/auth/register",
            json={
                "email": "collab-editor@example.com",
                "password": "testpass123",
                "full_name": "Collab Editor",
                "locale": "en",
            },
        )
        assert collaborator_user.status_code == 201

        create = client.post(
            "/api/v1/memorials",
            headers=owner_headers,
            json={
                "slug": "collab-owner-memorial",
                "translations": {"en": {"name": "Collab Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        invite = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
            json={"email": "collab-editor@example.com", "role": "EDITOR"},
        )
        assert invite.status_code == 201
        assert invite.json()["role"] == "EDITOR"
        assert invite.json()["accepted_at"] is None

        listing = client.get(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
        )
        assert listing.status_code == 200
        items = listing.json()["items"]
        emails = {item["email"] for item in items}
        assert "collab-owner@example.com" in emails
        assert "collab-editor@example.com" in emails

    def test_collaborator_can_accept_invitation(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        owner_user = User(email="invite-owner@example.com", full_name="Invite Owner", locale="en", hashed_password=hash_password("testpass123"))
        collaborator_user = User(email="invite-user@example.com", full_name="Invite User", locale="en", hashed_password=hash_password("testpass123"))
        db_session.add(owner_user)
        db_session.add(collaborator_user)
        db_session.flush()

        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_user.id)}"}
        collaborator_headers = {"Authorization": f"Bearer {create_access_token(collaborator_user.id)}"}

        create = client.post(
            "/api/v1/memorials",
            headers=owner_headers,
            json={
                "slug": "invite-accept-memorial",
                "translations": {"en": {"name": "Invite Accept Memorial"}},
            },
        )
        memorial_id = create.json()["id"]

        invite = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
            json={"email": "invite-user@example.com", "role": "VIEWER"},
        )
        assert invite.status_code == 201
        collaborator_id = invite.json()["id"]

        invitations = client.get("/api/v1/collaborators/invitations", headers=collaborator_headers)
        assert invitations.status_code == 200
        assert any(item["id"] == collaborator_id for item in invitations.json()["items"])

        accept = client.post(f"/api/v1/collaborators/{collaborator_id}/accept", headers=collaborator_headers)
        assert accept.status_code == 200
        assert accept.json()["accepted_at"] is not None

        mine = client.get("/api/v1/memorials/mine", headers=collaborator_headers)
        assert mine.status_code == 200
        assert any(item["id"] == memorial_id for item in mine.json())

    def test_collaborator_can_decline_invitation_and_owner_can_remove_collaborator(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        owner_user = User(email="lifecycle-owner@example.com", full_name="Lifecycle Owner", locale="en", hashed_password=hash_password("testpass123"))
        invitee_user = User(email="lifecycle-invitee@example.com", full_name="Lifecycle Invitee", locale="en", hashed_password=hash_password("testpass123"))
        db_session.add(owner_user)
        db_session.add(invitee_user)
        db_session.flush()

        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_user.id)}"}
        invitee_headers = {"Authorization": f"Bearer {create_access_token(invitee_user.id)}"}

        create = client.post(
            "/api/v1/memorials",
            headers=owner_headers,
            json={"slug": "lifecycle-memorial", "translations": {"en": {"name": "Lifecycle Memorial"}}},
        )
        memorial_id = create.json()["id"]

        invite = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
            json={"email": "lifecycle-invitee@example.com", "role": "EDITOR"},
        )
        collaborator_id = invite.json()["id"]

        decline = client.delete(f"/api/v1/collaborators/{collaborator_id}", headers=invitee_headers)
        assert decline.status_code == 204

        reinvite = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
            json={"email": "lifecycle-invitee@example.com", "role": "EDITOR"},
        )
        assert reinvite.status_code == 201
        collaborator_id = reinvite.json()["id"]

        accept = client.post(f"/api/v1/collaborators/{collaborator_id}/accept", headers=invitee_headers)
        assert accept.status_code == 200

        remove = client.delete(
            f"/api/v1/memorials/{memorial_id}/collaborators/{collaborator_id}",
            headers=owner_headers,
        )
        assert remove.status_code == 204

    def test_owner_can_update_collaborator_role(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        owner_user = User(
            email="role-owner@example.com",
            full_name="Role Owner",
            locale="en",
            hashed_password=hash_password("testpass123"),
        )
        db_session.add(owner_user)
        db_session.commit()
        owner_headers = {"Authorization": f"Bearer {create_access_token(owner_user.id)}"}

        collaborator_user = User(
            email="role-collab@example.com",
            full_name="Role Collaborator",
            locale="en",
            hashed_password=hash_password("testpass123"),
        )
        db_session.add(collaborator_user)
        db_session.commit()

        create = client.post(
            "/api/v1/memorials",
            headers=owner_headers,
            json={
                "slug": "role-owner-memorial",
                "translations": {"en": {"name": "Role Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        invite = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
            json={"email": "role-collab@example.com", "role": "VIEWER"},
        )
        assert invite.status_code == 201
        collaborator_id = invite.json()["id"]

        update = client.patch(
            f"/api/v1/memorials/{memorial_id}/collaborators/{collaborator_id}",
            headers=owner_headers,
            json={"role": "EDITOR"},
        )
        assert update.status_code == 200
        assert update.json()["role"] == "EDITOR"

    def test_owner_can_resend_pending_collaborator_invitation(self, client: TestClient, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        owner = User(
            email="resend-owner@example.com",
            full_name="Resend Owner",
            locale="en",
            hashed_password=hash_password("testpass123"),
        )
        db_session.add(owner)
        db_session.commit()
        owner_headers = {"Authorization": f"Bearer {create_access_token(owner.id)}"}

        collaborator_user = User(
            email="resend-collab@example.com",
            full_name="Resend Collaborator",
            locale="en",
            hashed_password=hash_password("testpass123"),
        )
        db_session.add(collaborator_user)
        db_session.commit()

        create = client.post(
            "/api/v1/memorials",
            headers=owner_headers,
            json={
                "slug": "resend-owner-memorial",
                "translations": {"en": {"name": "Resend Owner Memorial"}},
            },
        )
        assert create.status_code == 201
        memorial_id = create.json()["id"]

        invite = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators",
            headers=owner_headers,
            json={"email": "resend-collab@example.com", "role": "VIEWER"},
        )
        assert invite.status_code == 201
        collaborator_id = invite.json()["id"]
        first_invited_at = invite.json()["invited_at"]

        resend = client.post(
            f"/api/v1/memorials/{memorial_id}/collaborators/{collaborator_id}/resend",
            headers=owner_headers,
        )
        assert resend.status_code == 200
        assert resend.json()["accepted_at"] is None
        assert resend.json()["invited_at"] >= first_invited_at

    def test_non_owner_cannot_manage_collaborators(self, client: TestClient, test_memorial, db_session: Session) -> None:
        from app.core.auth import create_access_token, hash_password
        from app.models.user import User

        outsider_user = User(email="collab-outsider@example.com", full_name="Collab Outsider", locale="en", hashed_password=hash_password("testpass123"))
        db_session.add(outsider_user)
        db_session.flush()
        headers = {"Authorization": f"Bearer {create_access_token(outsider_user.id)}"}

        response = client.get(
            f"/api/v1/memorials/{test_memorial.id}/collaborators",
            headers=headers,
        )
        assert response.status_code == 403
