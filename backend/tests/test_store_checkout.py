"""Store assignment and payment-provider integration tests."""

import hashlib
import hmac
import json
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.deps import get_db
from app.api.routes import store as store_routes
from app.core.auth import create_access_token, hash_password
from app.core.config import get_settings
from app.main import app
from app.models.enums import MemorialStatus, PaymentProvider, PurchaseStatus
from app.models.memorial import Memorial
from app.models.store import Purchase, StoreItem
from app.models.user import User


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(test_user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


@pytest.fixture(autouse=True)
def enable_test_checkout(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "payment_test_mode", True)
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    monkeypatch.setattr(settings, "zarinpal_merchant_id", None)
    monkeypatch.setattr(settings, "coinbase_commerce_api_key", None)


def _store_item(client: TestClient, key: str) -> dict:
    response = client.get("/api/v1/store/items")
    assert response.status_code == 200
    return next(item for item in response.json() if item["key"] == key)


class TestStoreAssignment:
    def test_memorial_item_requires_an_owned_memorial(
        self,
        client: TestClient,
        db_session: Session,
        test_user,
        test_memorial,
        auth_headers: dict[str, str],
    ) -> None:
        item = _store_item(client, "halvaa-blue-verification")

        missing = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={"store_item_id": item["id"], "provider": "STRIPE", "locale": "en"},
        )
        assert missing.status_code == 422

        other_user = User(
            email="store-other-owner@example.com",
            full_name="Store Other Owner",
            hashed_password=hash_password("testpass123"),
        )
        db_session.add(other_user)
        db_session.flush()
        other_memorial = Memorial(
            public_id="store-other-owner",
            slug="store-other-owner",
            status=MemorialStatus.DRAFT,
            created_by_id=other_user.id,
        )
        db_session.add(other_memorial)
        db_session.flush()
        forbidden = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={
                "store_item_id": item["id"],
                "memorial_id": str(other_memorial.id),
                "provider": "STRIPE",
                "locale": "en",
            },
        )
        assert forbidden.status_code == 403

        accepted = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={
                "store_item_id": item["id"],
                "memorial_id": str(test_memorial.id),
                "provider": "STRIPE",
                "locale": "en",
            },
        )
        assert accepted.status_code == 201
        purchase = db_session.get(Purchase, accepted.json()["purchase_id"])
        assert purchase is not None
        assert purchase.user_id == test_user.id
        assert purchase.memorial_id == test_memorial.id

    def test_account_item_rejects_memorial_assignment(
        self,
        client: TestClient,
        test_memorial,
        auth_headers: dict[str, str],
    ) -> None:
        item = _store_item(client, "extra-memorial-slot")
        response = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={
                "store_item_id": item["id"],
                "memorial_id": str(test_memorial.id),
                "provider": "STRIPE",
                "locale": "en",
            },
        )
        assert response.status_code == 422

    def test_checkout_requires_a_fully_completed_profile(
        self,
        client: TestClient,
        test_user,
        auth_headers: dict[str, str],
    ) -> None:
        item = _store_item(client, "extra-memorial-slot")
        test_user.address = None
        response = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={"store_item_id": item["id"], "provider": "STRIPE", "locale": "en"},
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "PROFILE_INCOMPLETE"

    @pytest.mark.parametrize(
        ("provider", "currency"),
        [("STRIPE", "USD"), ("ZARINPAL", "IRR"), ("CRYPTO", "USD")],
    )
    def test_explicit_gateway_selection(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        provider: str,
        currency: str,
    ) -> None:
        item = _store_item(client, "extra-memorial-slot")
        response = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={"store_item_id": item["id"], "provider": provider, "locale": "en"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["provider"] == provider
        assert payload["currency"] == currency
        assert payload["test_mode"] is True

    def test_unconfigured_gateway_is_rejected_without_test_mode(
        self,
        client: TestClient,
        db_session: Session,
        auth_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        item = _store_item(client, "extra-memorial-slot")
        purchases_before = len(db_session.exec(select(Purchase)).all())
        monkeypatch.setattr(get_settings(), "payment_test_mode", False)

        response = client.post(
            "/api/v1/store/checkout",
            headers=auth_headers,
            json={"store_item_id": item["id"], "provider": "STRIPE", "locale": "en"},
        )

        assert response.status_code == 503
        assert len(db_session.exec(select(Purchase)).all()) == purchases_before


class TestPaymentCallbacks:
    def test_crypto_webhook_requires_signature_and_marks_purchase_paid(
        self,
        client: TestClient,
        db_session: Session,
        test_user,
        test_memorial,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        _store_item(client, "halvaa-blue-verification")
        item = db_session.exec(select(StoreItem).where(StoreItem.key == "halvaa-blue-verification")).one()
        purchase = Purchase(
            user_id=test_user.id,
            store_item_id=item.id,
            memorial_id=test_memorial.id,
            provider=PaymentProvider.CRYPTO,
            status=PurchaseStatus.PENDING,
            amount=item.price_usd_cents,
            currency="USD",
        )
        db_session.add(purchase)
        db_session.flush()

        secret = "coinbase-test-secret"
        monkeypatch.setattr(get_settings(), "coinbase_commerce_webhook_secret", secret)
        body = json.dumps(
            {
                "event": {
                    "type": "charge:confirmed",
                    "data": {
                        "code": "TESTCHARGE",
                        "metadata": {"purchase_id": str(purchase.id)},
                    },
                }
            },
            separators=(",", ":"),
        ).encode()

        invalid = client.post(
            "/api/v1/store/crypto/webhook",
            content=body,
            headers={"content-type": "application/json", "x-cc-webhook-signature": "invalid"},
        )
        assert invalid.status_code == 400

        signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        accepted = client.post(
            "/api/v1/store/crypto/webhook",
            content=body,
            headers={"content-type": "application/json", "x-cc-webhook-signature": signature},
        )
        assert accepted.status_code == 200
        db_session.refresh(purchase)
        assert purchase.status == PurchaseStatus.ASSIGNED
        assert purchase.provider_reference == "TESTCHARGE"
        assert purchase.assignment_payload["badge"] == "VERIFIED"
        db_session.refresh(test_memorial)
        assert test_memorial.is_verified is True
        assert test_memorial.verified_at is not None

    def test_catalog_contains_requested_products_and_hides_paid_featured_status(
        self,
        client: TestClient,
    ) -> None:
        response = client.get("/api/v1/store/items")
        assert response.status_code == 200
        items = {item["key"]: item for item in response.json()}
        assert "halvaa-blue-verification" in items
        assert "ceramic-memorial-plaque-set" in items
        assert "custom-memorial-id" in items
        assert "featured-placement" not in items
        assert items["ceramic-memorial-plaque-set"]["item_metadata"]["pieces"] == 3
        assert items["custom-memorial-id"]["item_metadata"]["assignable_to"] == "account"

    def test_zarinpal_get_callback_verifies_and_redirects(
        self,
        client: TestClient,
        db_session: Session,
        test_user,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        _store_item(client, "extra-memorial-slot")
        item = db_session.exec(select(StoreItem).where(StoreItem.key == "extra-memorial-slot")).one()
        purchase = Purchase(
            user_id=test_user.id,
            store_item_id=item.id,
            provider=PaymentProvider.ZARINPAL,
            status=PurchaseStatus.PENDING,
            amount=item.price_irr,
            currency="IRR",
            assignment_payload={"locale": "fa"},
        )
        db_session.add(purchase)
        db_session.flush()

        async def fake_verify_zarinpal_payment(*, purchase: Purchase, authority: str) -> str:
            assert authority == "A000000000000000000000000000TEST"
            return "987654"

        monkeypatch.setattr(store_routes, "verify_zarinpal_payment", fake_verify_zarinpal_payment)
        response = client.get(
            "/api/v1/store/zarinpal/verify",
            params={
                "purchase_id": str(purchase.id),
                "Authority": "A000000000000000000000000000TEST",
                "Status": "OK",
            },
            follow_redirects=False,
        )
        assert response.status_code == 303
        assert response.headers["location"].endswith(f"/fa/store?payment=success&purchase_id={purchase.id}")
        db_session.refresh(purchase)
        assert purchase.status == PurchaseStatus.PAID
        assert purchase.provider_reference == "987654"

    def test_manual_completion_is_disabled_in_production(
        self,
        client: TestClient,
        db_session: Session,
        test_user,
        auth_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        _store_item(client, "extra-memorial-slot")
        item = db_session.exec(select(StoreItem).where(StoreItem.key == "extra-memorial-slot")).one()
        purchase = Purchase(
            user_id=test_user.id,
            store_item_id=item.id,
            provider=PaymentProvider.STRIPE,
            status=PurchaseStatus.PENDING,
            amount=item.price_usd_cents,
            currency="USD",
        )
        db_session.add(purchase)
        db_session.flush()
        monkeypatch.setattr(get_settings(), "environment", "production")

        response = client.post(
            f"/api/v1/store/checkout/{purchase.id}/manual-complete",
            headers=auth_headers,
        )
        assert response.status_code == 403
        db_session.refresh(purchase)
        assert purchase.status == PurchaseStatus.PENDING
