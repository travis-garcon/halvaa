from app.models.enums import PaymentProvider


IRAN_COUNTRY_CODES = {"IR", "IRN"}


def choose_payment_provider(*, locale: str | None, country_code: str | None) -> PaymentProvider:
    normalized_locale = (locale or "").lower()
    normalized_country = (country_code or "").upper()
    if normalized_locale.startswith("fa") or normalized_country in IRAN_COUNTRY_CODES:
        return PaymentProvider.ZARINPAL
    return PaymentProvider.STRIPE


def build_checkout_response(*, provider: PaymentProvider, purchase_id: str, amount: int, currency: str) -> dict[str, str | int]:
    # Production deployments should exchange this placeholder URL for real
    # Stripe Checkout Session or Zarinpal authority URLs after keys are set.
    return {
        "provider": provider.value,
        "purchase_id": purchase_id,
        "amount": amount,
        "currency": currency,
        "checkout_url": f"/store/checkout/{provider.value.lower()}?purchase={purchase_id}",
    }
