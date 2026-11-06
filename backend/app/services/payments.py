import hashlib
import hmac
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.models.enums import PaymentProvider
from app.models.store import Purchase, StoreItem


IRAN_COUNTRY_CODES = {"IR", "IRN"}


def choose_payment_provider(*, locale: str | None, country_code: str | None) -> PaymentProvider:
    normalized_locale = (locale or "").lower()
    normalized_country = (country_code or "").upper()
    if normalized_locale.startswith("fa") or normalized_country in IRAN_COUNTRY_CODES:
        return PaymentProvider.ZARINPAL
    return PaymentProvider.STRIPE


def payment_provider_is_configured(provider: PaymentProvider) -> bool:
    settings = get_settings()
    return {
        PaymentProvider.STRIPE: bool(settings.stripe_secret_key),
        PaymentProvider.ZARINPAL: bool(settings.zarinpal_merchant_id),
        PaymentProvider.CRYPTO: bool(settings.coinbase_commerce_api_key),
    }[provider]


def ensure_payment_provider_available(provider: PaymentProvider) -> None:
    settings = get_settings()
    if payment_provider_is_configured(provider):
        return
    if settings.payment_test_mode and not settings.is_production:
        return
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"{provider.value.title()} payments are not configured",
    )


def _fallback_checkout_response(*, provider: PaymentProvider, purchase_id: str, amount: int, currency: str) -> dict[str, str | int | bool | None]:
    ensure_payment_provider_available(provider)
    return {
        "provider": provider.value,
        "purchase_id": purchase_id,
        "amount": amount,
        "currency": currency,
        "checkout_url": f"/store/checkout/{provider.value.lower()}?purchase={purchase_id}",
        "provider_reference": None,
        "test_mode": True,
    }


def append_query_params(url: str, **params: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(params)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def create_stripe_checkout_session(*, purchase: Purchase, item: StoreItem, locale: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.stripe_secret_key:
        return _fallback_checkout_response(provider=PaymentProvider.STRIPE, purchase_id=str(purchase.id), amount=purchase.amount, currency=purchase.currency)

    title = item.title.get(locale) or item.title.get("en") or item.key
    description = item.description.get(locale) or item.description.get("en") or ""
    payload = {
        "mode": "payment",
        "success_url": f"{settings.stripe_success_url}&purchase_id={purchase.id}",
        "cancel_url": f"{settings.stripe_cancel_url}&purchase_id={purchase.id}",
        "client_reference_id": str(purchase.id),
        "metadata[purchase_id]": str(purchase.id),
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": str(purchase.amount),
        "line_items[0][price_data][product_data][name]": title,
        "line_items[0][price_data][product_data][description]": description[:900],
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.stripe.com/v1/checkout/sessions",
            data=payload,
            headers={"Authorization": f"Bearer {settings.stripe_secret_key}"},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe checkout could not be created")
    data = response.json()
    return {
        "provider": PaymentProvider.STRIPE.value,
        "purchase_id": str(purchase.id),
        "amount": purchase.amount,
        "currency": purchase.currency,
        "checkout_url": data["url"],
        "provider_reference": data["id"],
        "test_mode": False,
    }


async def create_zarinpal_checkout(*, purchase: Purchase, item: StoreItem, locale: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.zarinpal_merchant_id:
        return _fallback_checkout_response(provider=PaymentProvider.ZARINPAL, purchase_id=str(purchase.id), amount=purchase.amount, currency=purchase.currency)

    base_url = "https://sandbox.zarinpal.com/pg/v4/payment/request.json" if settings.zarinpal_sandbox else "https://api.zarinpal.com/pg/v4/payment/request.json"
    gateway_base = "https://sandbox.zarinpal.com/pg/StartPay" if settings.zarinpal_sandbox else "https://www.zarinpal.com/pg/StartPay"
    title = item.title.get(locale) or item.title.get("en") or item.key
    callback_url = append_query_params(settings.zarinpal_callback_url, purchase_id=str(purchase.id))
    payload = {
        "merchant_id": settings.zarinpal_merchant_id,
        "amount": purchase.amount,
        "description": f"{settings.zarinpal_description}: {title}",
        "callback_url": callback_url,
        "metadata": {},
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(base_url, json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Zarinpal checkout could not be created")
    data = response.json().get("data") or {}
    authority = data.get("authority")
    if not authority:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Zarinpal did not return an authority")
    return {
        "provider": PaymentProvider.ZARINPAL.value,
        "purchase_id": str(purchase.id),
        "amount": purchase.amount,
        "currency": purchase.currency,
        "checkout_url": f"{gateway_base}/{authority}",
        "provider_reference": authority,
        "test_mode": False,
    }


async def create_crypto_checkout(*, purchase: Purchase, item: StoreItem, locale: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.coinbase_commerce_api_key:
        return _fallback_checkout_response(provider=PaymentProvider.CRYPTO, purchase_id=str(purchase.id), amount=purchase.amount, currency=purchase.currency)

    title = item.title.get(locale) or item.title.get("en") or item.key
    description = item.description.get(locale) or item.description.get("en") or ""
    payload = {
        "name": title,
        "description": description[:900],
        "pricing_type": "fixed_price",
        "local_price": {"amount": f"{purchase.amount / 100:.2f}", "currency": "USD"},
        "metadata": {"purchase_id": str(purchase.id), "user_id": str(purchase.user_id)},
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.commerce.coinbase.com/charges",
            json=payload,
            headers={
                "X-CC-Api-Key": settings.coinbase_commerce_api_key,
                "X-CC-Version": "2018-03-22",
                "Content-Type": "application/json",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Crypto checkout could not be created")
    charge = response.json().get("data") or {}
    return {
        "provider": PaymentProvider.CRYPTO.value,
        "purchase_id": str(purchase.id),
        "amount": purchase.amount,
        "currency": purchase.currency,
        "checkout_url": charge.get("hosted_url") or "",
        "provider_reference": charge.get("code") or charge.get("id"),
        "test_mode": False,
    }


async def verify_zarinpal_payment(*, purchase: Purchase, authority: str) -> str:
    settings = get_settings()
    if not settings.zarinpal_merchant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zarinpal is not configured")
    url = "https://sandbox.zarinpal.com/pg/v4/payment/verify.json" if settings.zarinpal_sandbox else "https://api.zarinpal.com/pg/v4/payment/verify.json"
    payload = {
        "merchant_id": settings.zarinpal_merchant_id,
        "amount": purchase.amount,
        "authority": authority,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Zarinpal verification failed")
    data = response.json().get("data") or {}
    code = data.get("code")
    if code not in {100, 101}:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment was not approved")
    return str(data.get("ref_id") or authority)


def verify_stripe_webhook_signature(payload: bytes, signature_header: str | None) -> bool:
    settings = get_settings()
    if not settings.stripe_webhook_secret or not signature_header:
        return False
    parts = dict(part.strip().split("=", 1) for part in signature_header.split(",") if "=" in part)
    timestamp = parts.get("t")
    signature = parts.get("v1")
    if not timestamp or not signature:
        return False
    signed_payload = f"{timestamp}.".encode() + payload
    expected = hmac.new(settings.stripe_webhook_secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_coinbase_webhook_signature(payload: bytes, signature_header: str | None) -> bool:
    settings = get_settings()
    if not settings.coinbase_commerce_webhook_secret or not signature_header:
        return False
    expected = hmac.new(settings.coinbase_commerce_webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
