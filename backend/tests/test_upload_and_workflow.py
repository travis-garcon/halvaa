import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pathlib import Path

from app.main import app
from app.core.config import get_settings
from app.models.enums import MediaType, MemorialStatus
from app.services.memorial_workflow import assert_valid_status_transition
from app.services.upload_validator import _detect_media_type


class TestMediaTypeDetection:
    def test_jpeg_resolves_as_image(self) -> None:
        assert _detect_media_type(".jpg") == MediaType.IMAGE

    def test_webp_resolves_as_image_not_document(self) -> None:
        assert _detect_media_type(".webp") == MediaType.IMAGE

    def test_pdf_resolves_as_document(self) -> None:
        assert _detect_media_type(".pdf") == MediaType.DOCUMENT


class TestMemorialStatusTransitions:
    def test_draft_to_pending_approval(self) -> None:
        assert_valid_status_transition(MemorialStatus.DRAFT, MemorialStatus.PENDING_APPROVAL)

    def test_pending_to_published(self) -> None:
        assert_valid_status_transition(MemorialStatus.PENDING_APPROVAL, MemorialStatus.PUBLISHED)

    def test_published_to_featured(self) -> None:
        assert_valid_status_transition(MemorialStatus.PUBLISHED, MemorialStatus.FEATURED)

    def test_featured_to_published_rejected(self) -> None:
        with pytest.raises(HTTPException) as exc:
            assert_valid_status_transition(MemorialStatus.FEATURED, MemorialStatus.PUBLISHED)
        assert exc.value.status_code == 400

    def test_published_to_draft_rejected(self) -> None:
        with pytest.raises(HTTPException) as exc:
            assert_valid_status_transition(MemorialStatus.PUBLISHED, MemorialStatus.DRAFT)
        assert exc.value.status_code == 400

    def test_pending_to_draft_rejected(self) -> None:
        with pytest.raises(HTTPException) as exc:
            assert_valid_status_transition(MemorialStatus.PENDING_APPROVAL, MemorialStatus.DRAFT)
        assert exc.value.status_code == 400

    def test_draft_to_published_rejected(self) -> None:
        with pytest.raises(HTTPException) as exc:
            assert_valid_status_transition(MemorialStatus.DRAFT, MemorialStatus.PUBLISHED)
        assert exc.value.status_code == 400

    def test_featured_to_draft_rejected(self) -> None:
        with pytest.raises(HTTPException) as exc:
            assert_valid_status_transition(MemorialStatus.FEATURED, MemorialStatus.DRAFT)
        assert exc.value.status_code == 400

    def test_same_status_is_noop(self) -> None:
        assert_valid_status_transition(MemorialStatus.DRAFT, MemorialStatus.DRAFT)


class TestMediaRouteImports:
    def test_media_route_references_media_type_enum(self) -> None:
        from app.api.routes import media as media_route

        assert media_route.MediaType.IMAGE == MediaType.IMAGE


class TestUploadDeliveryHeaders:
    def test_versioned_uploads_are_cacheable(self) -> None:
        settings = get_settings()
        upload_root = Path(settings.upload_dir)
        sample = upload_root / "tests" / "cacheable.txt"
        sample.parent.mkdir(parents=True, exist_ok=True)
        sample.write_text("cache me", encoding="utf-8")

        with TestClient(app) as client:
            response = client.get("/uploads/tests/cacheable.txt?v=123")

        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "public, max-age=31536000, immutable"
        assert response.headers["Cross-Origin-Resource-Policy"] == "same-origin"
